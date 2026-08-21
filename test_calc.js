function calcValor(unidades) {
  if (unidades <= 12) return 9.9;
  if (unidades <= 24) return 8.5;
  if (unidades <= 40) return 8.0;
  if (unidades <= 60) return 7.5;
  if (unidades <= 80) return 7.0;
  if (unidades <= 100) return 6.5;
  if (unidades <= 150) return 6.0;
  if (unidades <= 200) return 5.5;
  if (unidades <= 300) return 5.0;
  return 4.5;
}
console.log(calcValor(54) * 54);
