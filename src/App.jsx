import { useEffect, useRef, useState, useCallback } from 'react'
import { createStompClient, subscribeBlueprint } from './lib/stompClient.js'
import { createSocket } from './lib/socketIoClient.js'
import { listBlueprints, getBlueprint, createBlueprint, updateBlueprint, deleteBlueprint } from './lib/api.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080' // Spring
const IO_BASE  = import.meta.env.VITE_IO_BASE  ?? 'http://localhost:3001' // Node/Socket.IO

export default function App() {
  const tech = 'socketio' // Fixed to Socket.IO only
  const [author, setAuthor] = useState('juan')
  const [name, setName] = useState('plano-1')
  const [blueprints, setBlueprints] = useState([])
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)

  const stompRef = useRef(null)
  const unsubRef = useRef(null)
  const socketRef = useRef(null)

  const drawAll = useCallback((bp) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0,0,900,500)
    if (!bp.points || bp.points.length === 0) return
    
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    bp.points.forEach((p,i)=> {
      if (i===0) ctx.moveTo(p.x,p.y)
      else ctx.lineTo(p.x,p.y)
    })
    ctx.stroke()
    
    // Dibujar puntos como círculos para mejor visibilidad
    ctx.fillStyle = '#007bff'
    bp.points.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [])

  // Load selected blueprint
  useEffect(() => {
    let ignore = false
    setLoading(true); setError('')
    getBlueprint(author, name)
      .then(bp => { 
        if(!ignore){ 
          setPoints(bp.points || [])
          drawAll(bp)
        } 
      })
      .catch(e => { 
        if(!ignore) {
          console.warn('Blueprint load error:', e.message)
          // No mostrar error en UI si es solo que no existe
          if (!e.message.includes('404')) {
            setError(e.message)
          }
        }
      })
      .finally(()=> { if(!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [author, name, drawAll])

  // Load list for author
  useEffect(() => {
    let ignore = false
    listBlueprints(author)
      .then(list => { if(!ignore) setBlueprints(list) })
      .catch(()=>{})
    return () => { ignore = true }
  }, [author, points.length])

  const redrawFromState = useCallback(() => drawAll({ points }), [points, drawAll])

  useEffect(() => {
    unsubRef.current?.(); unsubRef.current = null
    stompRef.current?.deactivate?.(); stompRef.current = null
    socketRef.current?.disconnect?.(); socketRef.current = null

    if (tech === 'stomp') {
      const client = createStompClient(API_BASE)
      stompRef.current = client
      client.onConnect = () => {
        unsubRef.current = subscribeBlueprint(client, author, name, (upd)=> {
          drawAll({ points: upd.points })
        })
      }
      client.activate()
    } else {
      const s = createSocket(IO_BASE)
      socketRef.current = s
      const room = `blueprints.${author}.${name}`
      s.emit('join-room', room)
      s.on('connect', ()=> console.log('socket.io connected', s.id))
      s.on('blueprint-update', (upd)=> {
        const incoming = Array.isArray(upd.points) ? upd.points : []
        setPoints(prev => {
          // Compat: si llega un solo punto, asumimos incremental -> append
          if (incoming.length === 1) {
            const merged = [...prev, incoming[0]]
            drawAll({ points: merged })
            return merged
          }
          // Si llega lista completa, reemplazamos
          drawAll({ points: incoming })
          return incoming
        })
      })
    }
    return () => {
      unsubRef.current?.(); unsubRef.current = null
      stompRef.current?.deactivate?.()
      socketRef.current?.disconnect?.()
    }
  }, [tech, author, name, drawAll])

  function onClick(e) {
    const rect = e.target.getBoundingClientRect()
    const point = { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) }
    const newPoints = [...points, point]
    setPoints(newPoints)
    
    drawAll({ points: newPoints })
    
    if (tech === 'stomp' && stompRef.current?.connected) {
      stompRef.current.publish({ destination: '/app/draw', body: JSON.stringify({ author, name, point }) })
    } else if (tech === 'socketio' && socketRef.current?.connected) {
      const room = `blueprints.${author}.${name}`
      socketRef.current.emit('draw-event', { room, author, name, point })
    }
  }

  function onCreate() {
    const newName = window.prompt('Nombre nuevo plano:')
    if (!newName) return
    setLoading(true)
    setError('')
    createBlueprint(author, newName)
      .then(()=> { 
        setName(newName)
        setPoints([])
        drawAll({ points: [] })
        return listBlueprints(author)
      })
      .then(setBlueprints)
      .catch(e => {
        console.error('Create error:', e)
        setError(`Error al crear: ${e.message}`)
      })
      .finally(() => setLoading(false))
  }

  function onSave() {
    setLoading(true)
    setError('')
    updateBlueprint(author, name, points)
      .then(bp => { 
        setPoints(bp.points)
        drawAll(bp)
        return listBlueprints(author)
      })
      .then(setBlueprints)
      .catch(e => {
        console.error('Save error:', e)
        setError(`Error al guardar: ${e.message}`)
      })
      .finally(() => setLoading(false))
  }

  function onDelete() {
    if (!window.confirm(`¿Eliminar plano ${name}?`)) return
    setLoading(true)
    setError('')
    deleteBlueprint(author, name)
      .then(()=> {
        // Limpiar canvas y puntos locales inmediatamente
        setPoints([])
        drawAll({ points: [] })
        // Recargar lista
        return listBlueprints(author)
      })
      .then(list => { 
        setBlueprints(list)
        if (list.length > 0) { 
          setName(list[0].name)
          setPoints(list[0].points || [])
          drawAll(list[0])
        } else { 
          setName('plano-1')
          setPoints([])
          drawAll({ points: [] })
        }
      })
      .catch(e => {
        console.error('Delete error:', e)
        setError(`Error al eliminar: ${e.message}`)
      })
      .finally(() => setLoading(false))
  }

  const totalPoints = blueprints.reduce((acc,b)=> acc + (b.points?.length||0), 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '0'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(13, 27, 42, 0.95)',
        padding: '20px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{margin: 0, fontSize: '28px', fontWeight: '600'}}>
          ECI - Laboratorio de Blueprints en React
        </h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <button style={{
            background: '#4a90e2',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}>Blueprints</button>
          <button style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}>Login</button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{padding: '40px', display: 'flex', gap: '30px', maxWidth: '1400px', margin: '0 auto'}}>
        
        {/* Left Sidebar */}
        <div style={{flex: '0 0 480px', display: 'flex', flexDirection: 'column', gap: '24px'}}>
          
          {/* Blueprints Panel */}
          <div style={{
            background: 'rgba(30, 58, 95, 0.6)',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h2 style={{margin: '0 0 16px 0', fontSize: '22px', fontWeight: '600'}}>Blueprints</h2>
            <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
              <input 
                value={author} 
                onChange={e=>setAuthor(e.target.value)} 
                placeholder="Autor"
                style={{
                  flex: 1,
                  background: 'rgba(13, 27, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
              <button 
                onClick={onCreate}
                style={{
                  background: '#4a90e2',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >Get blueprints</button>
            </div>
            {error && <div style={{
              background: 'rgba(220, 53, 69, 0.2)',
              color: '#ff6b6b',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '14px',
              border: '1px solid rgba(220, 53, 69, 0.3)'
            }}>Error: {error}</div>}
          </div>

          {/* Author's Blueprints */}
          <div style={{
            background: 'rgba(30, 58, 95, 0.6)',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600'}}>
              {author}'s blueprints:
            </h3>
            {blueprints.length === 0 ? (
              <p style={{margin: 0, opacity: 0.7, fontSize: '14px'}}>Sin resultados.</p>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {blueprints.map(b => (
                  <div 
                    key={b.name}
                    onClick={()=> { setName(b.name); setPoints(b.points); drawAll(b) }}
                    style={{
                      background: b.name === name ? 'rgba(74, 144, 226, 0.3)' : 'rgba(13, 27, 42, 0.5)',
                      padding: '12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px'
                    }}
                  >
                    <span>{b.name}</span>
                    <span style={{opacity: 0.7}}>{b.points?.length || 0} pts</span>
                  </div>
                ))}
                <div style={{
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Total points: {totalPoints}
                </div>
              </div>
            )}
          </div>

          {/* Top 5 Blueprints */}
          <div style={{
            background: 'rgba(30, 58, 95, 0.6)',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{margin: '0', fontSize: '18px', fontWeight: '600'}}>Top 5 Blueprints</h3>
          </div>
        </div>

        {/* Right Canvas Area */}
        <div style={{flex: 1}}>
          <div style={{
            background: 'rgba(30, 58, 95, 0.6)',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
              <h2 style={{margin: 0, fontSize: '20px', fontWeight: '600'}}>Current blueprint: {name}</h2>
              <div style={{display: 'flex', gap: '8px'}}>
                <button 
                  onClick={onSave} 
                  disabled={!points.length}
                  style={{
                    background: points.length ? '#28a745' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: points.length ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    opacity: points.length ? 1 : 0.5
                  }}
                >Save</button>
                <button 
                  onClick={onDelete}
                  style={{
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >Delete</button>
              </div>
            </div>
            <input 
              value={name} 
              onChange={e=>setName(e.target.value)} 
              placeholder="Nombre del blueprint actual"
              style={{
                width: '100%',
                background: 'rgba(13, 27, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            />
            <canvas
              ref={canvasRef}
              width={900}
              height={500}
              style={{
                background: 'rgba(13, 27, 42, 0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                cursor: 'crosshair',
                width: '100%',
                display: 'block'
              }}
              onClick={onClick}
            />
          </div>
        </div>
      </div>
      
      {loading && <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'rgba(74, 144, 226, 0.9)',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: '500'
      }}>Cargando...</div>}
    </div>
  )
}
