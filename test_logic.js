const paths = ["/admin/comercial/categorias/novo", "/admin/comercial", "/admin/comercial-externo"];
const itemPath = "/admin/comercial";
paths.forEach(p => {
  console.log(p, p === itemPath || p.startsWith(itemPath + "/"));
});
