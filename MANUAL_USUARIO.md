# Manual de Usuario

## Avisos Impresos PDF

Esta herramienta permite crear avisos legales y edictos para prensa con medidas exactas en centimetros, vista previa vectorial y exportacion a PDF listo para impresion.

## Flujo Rapido

1. Selecciona el tamano del aviso en centimetros.
2. Ajusta el margen de texto.
3. Pega o escribe el contenido del aviso.
4. Sube el logo o imagen si aplica.
5. Ajusta fuente, interlineado y alineacion.
6. Revisa que no exista alerta de desborde.
7. Descarga el PDF en tamano real o en hoja A4.

## Barra Superior

- **Cargar Ejemplo Imagen**: carga un aviso de muestra para partir de una referencia.
- **Limpiar**: reinicia el formulario a los valores por defecto.
- **Descargar PDF (Cm Real)**: exporta un PDF con el tamano exacto del aviso.
- **Icono de hoja A4**: exporta una hoja A4 con multiples avisos.

Si hay desborde de texto, los botones de PDF se deshabilitan hasta corregirlo.

## Dimensiones y Margen

En el panel izquierdo puedes escoger medidas predefinidas como `6.3 x 3 cm`, `6.3 x 4 cm`, etc.

Tambien puedes crear un tamano personalizado:

1. Haz clic en **Anadir Otro Tamano en Centimetros**.
2. Escribe ancho y alto.
3. Opcionalmente agrega una etiqueta.
4. Guarda el nuevo tamano.

El control **Margen de Texto** define el espacio interno entre el borde y el contenido. Para prensa se recomienda mantenerlo entre `1 mm` y `3 mm`, segun el espacio disponible.

## Texto del Aviso

Pega el texto principal en el area **Contenido del Texto y Logo**.

Controles disponibles:

- **Sin Retornos**: elimina saltos de linea innecesarios para que el texto fluya como parrafo continuo.
- **Negrita**: aplica negrita al texto seleccionado.
- **Resaltar Nombres**: detecta nombres, empresas, NIT, cedulas y documentos para resaltarlos automaticamente.
- **Limpiar**: elimina los resaltados automaticos.
- **.TXT**: permite importar un archivo de texto plano.

## Resaltado de Nombres y Documentos

El boton **Resaltar Nombres** actualiza el conteo de elementos resaltados y aplica negrita en la compilacion Typst.

Ejemplos de elementos que puede detectar:

- Nombres en mayusculas.
- Razones sociales.
- `NIT 900.743.745-1`.
- `Cedula de Ciudadania No. 1.093.224.471`.
- Nombres despues de `senor`, `senora`, `Sr.` o `Sra.`.

Si necesitas resaltar algo especifico, selecciona el texto y usa **Negrita**.

## Logo o Imagen

En la seccion **Logo Escudo** puedes:

- Subir una imagen.
- Quitar la imagen activa.
- Usar un logo de ejemplo.
- Cambiar el ancho del logo.
- Escoger posicion:
  - Izquierda flotante.
  - Derecha flotante.
  - Centrado arriba.

El logo se procesa en escala de grises desde Typst para que sea apto para impresion en rotativa. El texto y bordes se generan en negro.

## Atributos Rapidos

Sobre el lienzo hay una barra de atributos rapidos:

- **Fuente**: cambia la familia tipografica.
- **Letra**: aumenta o reduce el tamano del cuerpo.
- **Inter**: aumenta o reduce el interlineado.
- **Alineacion**: justificado, izquierda o centro.
- **Auto-Encajar**: ajusta automaticamente la fuente para evitar desborde.
- **Guia 3 mm**: muestra u oculta la guia visual de margen.

El control **Inter** es util cuando el texto casi cabe: reducirlo ligeramente puede evitar un desborde sin bajar demasiado la letra.

## Vista Previa

La vista previa usa el mismo motor Typst CLI que genera el PDF final. Por eso debe coincidir con la salida exportada.

Debajo del aviso se muestran indicadores visibles:

- Motor de renderizado.
- Tamano exacto del aviso.
- Conteo de palabras.
- Interlineado actual.

## Desborde de Texto

La aplicacion detecta cuando el contenido excede el area del aviso.

Cuando hay desborde:

- Aparece una alerta roja.
- El borde de la vista previa se resalta.
- La exportacion PDF se deshabilita.

Formas de corregirlo:

- Usar **Auto-Encajar**.
- Reducir tamano de letra.
- Reducir interlineado.
- Reducir margen.
- Escoger un aviso mas alto.
- Acortar el texto.

## Exportacion PDF

Hay dos salidas principales:

- **PDF Cm Real**: genera un archivo con las medidas exactas del aviso.
- **Hoja A4**: genera una hoja con multiples copias del aviso, util para revision o imposicion basica.

Antes de exportar, confirma:

- No hay alerta de desborde.
- El logo esta en la posicion correcta.
- El conteo de palabras y el tamano son los esperados.
- Los nombres/documentos importantes estan en negrita.

## Recomendaciones Para Rotativa

- Usa imagenes con buen contraste.
- Evita logos demasiado pequenos.
- Revisa que el texto no quede pegado al borde.
- Mantén el margen entre `1 mm` y `3 mm`.
- Prefiere negritas solo para nombres, entidades y documentos importantes.
- Verifica el PDF final antes de enviarlo a impresion.

## Solucion de Problemas

### No se genera el PDF

Revisa si hay alerta de desborde. Si la hay, ajusta texto, fuente o tamano del aviso.

### El logo no aparece

Quita el logo y vuelve a subirlo. Se recomiendan formatos `PNG`, `JPG`, `SVG`, `GIF` o `WEBP`.

### Las negritas no se ven

Usa **Resaltar Nombres** o selecciona el texto y presiona **Negrita**. Luego espera a que termine la compilacion.

### La alineacion se ve como texto

Si aparecen etiquetas como `[center]`, vuelve a seleccionar el texto y aplica la alineacion desde los botones del panel. La compilacion Typst debe convertir esas etiquetas en alineacion real.

### El texto se parte raro alrededor del logo

Reduce un poco el ancho del logo, cambia su posicion o ajusta el interlineado. La aplicacion protege frases legales comunes para evitar cortes no naturales.
