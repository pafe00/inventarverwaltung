import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const API_URL =
    'https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net'

  const [inventar, setInventar] = useState([])
  const [loading, setLoading] = useState(true)
  const [suche, setSuche] = useState('')

  const [form, setForm] = useState({
    id: '',
    name: '',
    kategorie: '',
    hersteller: '',
    seriennummer: '',
    standort: '',
    status: 'verfügbar',
    bemerkung: '',
  })

  const ladeInventar = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/inventar`)
      const data = await response.json()
      setInventar(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ladeInventar()
  }, [])

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const neuesItem = {
      id: Number(form.id),
      name: form.name,
      kategorie: form.kategorie,
      hersteller: form.hersteller || null,
      seriennummer: form.seriennummer || null,
      standort: form.standort,
      status: form.status,
      bemerkung: form.bemerkung || null,
    }

    const response = await fetch(`${API_URL}/api/inventar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(neuesItem),
    })
export default App