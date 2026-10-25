# Marées France

## Presentación

Esta integración trae a Gladys las mareas de los puertos franceses, según las predicciones del SHOM (el servicio hidrográfico de la Marina francesa, el de maree.shom.fr): horas y alturas de pleamares y bajamares, coeficientes y la altura del agua en todo momento. Cubre 387 puertos: Francia metropolitana, ultramar y algunos puertos extranjeros.

Cada puerto se convierte en un dispositivo, las escenas se activan antes de cada marea o en las mareas vivas, y tres widgets muestran la curva del día, las próximas mareas y los coeficientes.

![Los tres widgets: marea del día con su curva, próximas mareas, coeficientes de marea (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-marees-france/main/docs/assets/widgets.es.png)

Las predicciones son propiedad del SHOM y no sustituyen los documentos náuticos oficiales. Esta integración comunitaria no está afiliada al SHOM.

## Requisitos

- Gladys Assistant 5.3.0 o más reciente.
- Acceso a Internet desde Gladys. Sin cuenta ni clave.

## Configuración

| Campo                | Función                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Puerto               | El puerto principal, en la lista del SHOM. Escriba sus primeras letras para ir a él.         |
| Otros puertos        | Hasta cuatro más, por nombre, separados por comas: `Saint-Malo, Roscoff`.                    |
| Idioma de los textos | Idioma de los nombres de dispositivos, estados de texto y resúmenes. Automático por defecto. |

El botón **Buscar un puerto** comprueba un nombre (sin importar acentos ni mayúsculas) y muestra los puertos que coinciden. **Descargar ahora** vuelve a descargar las mareas (se hace solo una vez al día, de noche). El estado de conexión indica los puertos seguidos y los nombres no encontrados.

## Uso

### Dispositivos

Abra la pestaña **Descubrir** y añada los dispositivos «Marea &lt;puerto&gt;». Cada uno tiene: la altura del agua (m, en pasos de 5 minutos), la marea (subiendo o bajando), la próxima marea en texto («Pleamar a las 20:22 (6,07 m, coef. 62)»), los minutos hasta la próxima pleamar y bajamar y sus alturas, el coeficiente de la próxima pleamar y el coeficiente máximo de mañana (para los puertos con coeficientes). Las alturas son sobre el cero hidrográfico, como en maree.shom.fr; las horas siguen la zona horaria de Gladys.

### Widgets del panel

- **Marea del día**: altura del agua, tendencia, próxima marea, coeficiente y curva del día con sus pleamares y bajamares.
- **Próximas mareas**: las ocho siguientes, fechadas, con su coeficiente.
- **Coeficientes de marea**: dos semanas en barras, el pico y la próxima marea viva (coeficiente ≥ 95).

Cada widget tiene un ajuste **Puerto** (un dispositivo de puerto ya añadido); vacío, muestra el primer puerto de la configuración.

### Escenas

- **Marea: pleamar o bajamar**: a la hora de la marea o de 15 minutos a 6 horas antes. Filtros: puerto, tipo de marea.
- **Marea: marea viva**: una pleamar cuyo coeficiente alcanza un umbral (70 a 115), a su hora o hasta el día antes. Se da la hora de la bajamar siguiente.
- Acción **Marea: leer la próxima marea**: hora, altura, coeficiente, altura actual y un resumen listo para un mensaje.

Ejemplos: una hora antes de la pleamar, enviar su hora y altura por Telegram; el día antes de una marea viva de coeficiente 95 o más, avisar para el marisqueo; en la bajamar, cerrar una persiana.

Un evento perdido por más de 10 minutos (Gladys detenido) no se reproduce, y cada evento se envía una sola vez, incluso tras un reinicio.

### Transporte

Los datos vienen de los servicios del SHOM por Internet (insignia «cloud»). Solo el código del puerto aparece en las solicitudes: nada sobre usted sale de su red. Bastan tres solicitudes por puerto y por día; todo lo demás se calcula en el contenedor.

## Solución de problemas

- **«Puerto no encontrado»**: use el botón Buscar un puerto y copie el nombre exacto en «Otros puertos».
- **«El SHOM rechaza las solicitudes»**: su cortafuegos bloquea a veces una dirección un tiempo. La integración lo reintenta sola unas horas después y conserva los datos de los días anteriores (8 días de mareas).
- **Sin coeficiente**: el SHOM no publica para algunos puertos de ultramar.
- **Informe de error**: pulse **Diagnóstico** y copie las líneas «Diagnostic:» de la pestaña Registros, con las versiones de Gladys y de la integración (Gladys no pasa `DEBUG` al contenedor).
