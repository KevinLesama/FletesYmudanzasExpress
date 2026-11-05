# Capturas de pantalla

Acá viven las imágenes que muestra el [`README.md`](../../README.md) principal.

## Nombres esperados

Dejá los archivos con **exactamente** estos nombres. Si el nombre no coincide, la imagen no se ve en GitHub.

| Archivo | Pantalla | Ruta en la app |
|---|---|---|
| `01-agenda.png` | Agenda semanal | `/agenda` |
| `02-solicitudes.png` | Listado de solicitudes | `/solicitudes` |
| `03-planificacion.png` | Planificación de un viaje | `/planificacion` |
| `04-flota.png` | Flota: choferes y vehículos | `/flota` |
| `05-pagos.png` | Pagos y resumen de cobros | `/pagos` |

## Formato recomendado

- **Ancho**: 1600 px o 1920 px. Menos que eso se ve borroso en pantallas grandes.
- **Formato**: PNG (o WebP si querés achicar el peso).
- **Peso**: apuntá a menos de 500 KB por imagen. Las capturas a pantalla completa en PNG pesan mucho; si pasás ese número, probá WebP.
- **Datos sensibles**: antes de subir, revisá que no se vean emails, teléfonos ni direcciones reales de clientes.

## Cómo agregarlas

1. Copiá los archivos a esta carpeta con los nombres de la tabla.
2. Verificá que aparezcan en el README.
3. Commiteá la carpeta completa:

```bash
git add docs/screenshots
git commit -m "docs(readme): agrega capturas reales de la app"
git push
```

> Si preferís otro formato (`jpg`, `webp`), cambiá también la extensión en el `README.md` principal.
