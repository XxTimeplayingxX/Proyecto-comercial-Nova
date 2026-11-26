# Trazabilidad de productos

En **Productos → Ver trazabilidad**, un administrador activo puede abrir el historial por fila. La cabecera muestra la identidad y la fecha de alta en catálogo. Los movimientos muestran la fecha, las unidades, el stock anterior y nuevo, quién realizó el movimiento y el motivo. Las ventas muestran la referencia, el estado, el vendedor registrado en la venta y el nombre del comprador si se vinculó un cliente al vender.

Desde **Agregar stock**, el campo opcional **Punto de ingreso** permite anotar una bodega o sucursal de hasta 100 caracteres. Nova guarda el punto junto con el motivo y las observaciones en el movimiento del RPC existente. Los movimientos previos muestran lo que se registró en su momento. Los nombres proceden del perfil y del cliente tal como figuran actualmente. El producto conserva cantidades agregadas, por lo que el historial relaciona ventas con el producto, sin asignar una unidad vendida a un lote individual.

## API local

`GET /api/productos/{id}/trazabilidad?antesDe={cursor}` requiere cookie de Nova y administrador activo. `id` debe ser positivo. `antesDe` es opcional y se copia de `siguiente` en la página anterior.

```json
{
  "producto": {"nombre":"Producto de prueba","sku":"TEST-001","alta":"2026-11-25T14:00:00Z"},
  "siguiente": null,
  "items": [{
    "tipo":"sale","fecha":"2026-11-25T15:00:00Z","cantidad":1,
    "stockAnterior":5,"stockNuevo":4,"motivo":null,"responsable":"Vendedor de prueba",
    "venta":{"id":"12","estado":"completed","vendedor":"Vendedor de prueba","comprador":null}
  }]
}
```

**200** devuelve hasta 20 movimientos, ordenados por ID descendente. `siguiente` es un cursor decimal como texto o null. `venta` es null sin venta asociada. **400** parámetros inválidos, **401** sesión, **403** permisos, **404** producto no visible o inexistente, **502/503** fallo externo.

Nova consulta `products` para el alta y `stock_movements` filtrado por producto, con relaciones a `profiles`, `sales` y `customers`. RLS permite a administradores consultar los movimientos. El endpoint comprueba de nuevo el perfil con su JWT. Expone nombres y referencias de venta. El esquema, relaciones y permisos se comprobaron con SQL el 2026-11-25.

Se comprobó que la línea de venta existente tenía un movimiento asociado. En el host aislado se verificaron el comprador registrado y el comprador anónimo, el cursor, el punto de ingreso y el acceso restringido. Pendiente comprobar la pantalla con un JWT real y en navegador.
