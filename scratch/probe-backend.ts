async function probe() {
  const urls = [
    'http://localhost:8000/api/v1/health',
    'http://localhost:8000/api/v1/docs',
    'http://localhost:8000/api/v1/users',
    'http://localhost:8000/api/v1/auth',
    'http://localhost:8000/api/v1/auth/login',
    'http://localhost:8000/api/v1/auth/demo',
    'http://localhost:8000/api/v1/demo',
    'http://localhost:8000/api/v1/demo/users',
    'http://localhost:8000/api/v1/demo/token',
    'http://localhost:8000/api/v1/demo/auth',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      console.log(`GET ${url} -> ${res.status}: ${text.substring(0, 100)}`);
    } catch (e: any) {
      console.log(`GET ${url} -> ERROR: ${e.message}`);
    }
  }

  // Also try POST
  for (const url of [
    'http://localhost:8000/api/v1/auth/demo',
    'http://localhost:8000/api/v1/demo/auth',
    'http://localhost:8000/api/v1/demo/token',
    'http://localhost:8000/api/v1/demo/login'
  ]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'anusha@mahasetu.gov.in' })
      });
      const text = await res.text();
      console.log(`POST ${url} -> ${res.status}: ${text.substring(0, 100)}`);
    } catch (e: any) {
      console.log(`POST ${url} -> ERROR: ${e.message}`);
    }
  }

  process.exit(0);
}

probe();
