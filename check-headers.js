import http from 'http';

http.get('http://localhost:5173/dict/base.dat.gz', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
