# Decisiones y supuestos

## Segmentación (100 % automática, reglas de negocio)

| Segmento | Regla (umbrales configurables en Configuración) |
|---|---|
| Frecuente | ≥ 10 compras confirmadas en 12 meses, última compra hace ≤ 90 días y valor 12 m ≥ mínimo (0 por defecto) |
| Frío | Más de 90 días sin compra confirmada |
| Sin segmentar | Sin compras, o activo sin alcanzar el umbral de frecuente |

- No hay clasificación manual ni segmento «caliente»: cada cliente se clasifica solo por sus datos y se recalcula al importar, editar o cambiar reglas.
- Prioridad para evitar contradicciones: sin compras › frío › frecuente › sin segmentar.
- Cada cliente muestra el motivo y la evidencia (recencia, frecuencia, valor, historial).
- Con 90 días hay **41 clientes fríos**, igual que la referencia del reto. El umbral de 10 compras es el percentil 75 de los datos (el archivo de parámetros del reto sugiere 8).
- La fecha de referencia («hoy» del análisis) es 2026-10-31, la última fecha con datos; se cambia en Configuración.

## Asistente IA

- Modo por reglas (por defecto): reglas deterministas. Cada respuesta indica su tipo (**regla de negocio**, **análisis descriptivo** o **modelo entrenado**) y su evidencia. Un ranking por reglas nunca se presenta como probabilidad.
- Si hay menos de 3 clientes en el contexto o la pregunta no está cubierta, responde que no tiene datos suficientes.
- El asistente usa los **mismos filtros** activos de Segmentación.
- Modo conectado: adaptador HTTP hacia un backend propio (contrato en el README). Alertas y recomendaciones siguen siendo locales.

## Importación y exportación

- XLSX y CSV con SheetJS (sin iframes). `.xls` no se soporta. Máximo 10 MB y 20.000 filas.
- Mapeo automático por nombre y sinónimos (incluye los encabezados de los CSV del reto) y ajustable por el usuario.
- Fila con error → se reporta y no se importa; no se inventan valores. Duplicado dentro del archivo → se omite. Duplicado contra datos existentes → el usuario elige actualizar u omitir.
- Clientes: se detectan duplicados por identificador y por nombre de empresa normalizado.
- Ventas: la app no maneja catálogo de productos, así que `PRO99` del archivo de incidencias **no** se marca como error. Las otras incidencias (cliente inexistente, fecha imposible, moneda EUR, cantidad negativa, precio vacío y venta duplicada) sí se detectan.

## Servicios y operaciones

- Licencias, capacitaciones y bases de consulta traen registros iniciales editables.
- Estado de licencias con la fecha real de hoy: vencida (< 0 días), por vencer (≤ 30 días), vigente.

## Técnicas

- **Base de datos:** Firebase Cloud Firestore + Firebase Auth (correo/contraseña). Sin variables de Firebase, la app usa almacenamiento local y un usuario local (`operativo1`).
- Reglas de Firestore: solo usuarios autenticados. Si se agregan perfiles con distintos permisos, hay que endurecerlas por rol.
- **Tema:** paleta verde con complementarios (esmeralda, lima, verde azulado, ámbar), definida en variables CSS con valores claro/oscuro (`scripts/theme.mjs`). El modo se guarda por dispositivo.
- Fechas con selector propio (calendario y hora) para que se vea igual en web, iOS y Android y respete el tema.
- Gráficas: tooltip con el valor al pasar el mouse (web) o tocar (móvil) sobre cada punto o barra.
- En móvil el asistente es una pantalla propia; en escritorio (≥ 1280 px) vive en el panel derecho.
- `tslib` se instaló explícitamente porque `react-native-gifted-charts` lo requiere y no lo declara.
