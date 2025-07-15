require('dotenv').config();
console.log('HF Key:', process.env.HUGGINGFACE_API_KEY ? '✅ Set' : '❌ Not set');

fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ inputs: ['test IT project'] })
}).then(res => {
  console.log('Status:', res.status);
  return res.json();
}).then(data => {
  console.log('Response:', Array.isArray(data) ? data[0].length + ' dimensions' : 'Error:', data);
}).catch(err => console.log('Error:', err.message));