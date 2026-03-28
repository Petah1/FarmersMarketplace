const app = require('./app');
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    require('./jobs/confirmPayments').start();
  }
});
