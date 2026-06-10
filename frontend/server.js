import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 8080
const backendUrl = (process.env.BACKEND_URL || 'https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net').replace(/\/$/, '')

app.use('/api', express.raw({ type: '*/*', limit: '1mb' }))
app.use('/api', async (req, res) => {
  try {
    const targetUrl = `${backendUrl}${req.originalUrl}`
    const headers = { ...req.headers }
    delete headers.host
    delete headers.connection
    delete headers['content-length']

    const hasBody = !['GET', 'HEAD'].includes(req.method)
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
    })

    res.status(upstreamRes.status)
    upstreamRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return
      res.setHeader(key, value)
    })

    const body = Buffer.from(await upstreamRes.arrayBuffer())
    res.send(body)
  } catch (error) {
    console.error('API Proxy Fehler:', error)
    res.status(502).json({ detail: 'Backend nicht erreichbar' })
  }
})

app.use(express.static(path.join(__dirname, 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`Frontend läuft auf Port ${port}`)
})