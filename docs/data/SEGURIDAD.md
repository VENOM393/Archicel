# Seguridad de Archicel

Revisión del 20 de septiembre de 2026. Este documento dice **qué protege qué**, porque la
pregunta "¿está cifrado?" tiene una respuesta distinta en cada capa y confundirlas lleva a
creerse protegido donde no se está.

## Lo que se arregló en esta revisión

### 1 · Inyección de HTML en el saludo del escritorio · **grave**

El widget de bienvenida construía su frase concatenando HTML e insertándolo con
`dangerouslySetInnerHTML`. Dentro iban **títulos escritos por la usuaria**: una tarea
llamada `<img src=x onerror="…">` ejecutaba ese código cada vez que se abría la aplicación,
con acceso a la sesión de Firebase.

Ahora el mensaje se arma como trozos de texto que React escapa uno a uno. No queda ningún
`dangerouslySetInnerHTML` con datos de la usuaria; el único que existe pinta iconos de un
diccionario fijo del código, al que no llega nada de fuera.

**Regla para lo que venga:** ningún dato guardado —título, nota, asignatura— se convierte
nunca en HTML. Si hace falta énfasis, se trocea y se envuelve en elementos.

### 2 · Las reglas de Firestore se anulaban a sí mismas · **grave**

El fichero validaba con cuidado la forma de `eventos` y `tareas`… y terminaba con un
comodín `match /{coleccion}/{docId}` que permitía escribir en cualquier colección del
usuario, **incluidas esas dos**.

Los `match` de Firestore no se encadenan como filtros: se suman, y basta con que uno
permita la operación. El comodín ofrecía una puerta sin comprobaciones, así que todas las
validaciones de este fichero eran decorativas: se podía guardar un evento con un título de
diez megas o una fecha inventada.

El comodín ahora excluye explícitamente las colecciones ya validadas y acota el tamaño de
los documentos nuevos.

### 3 · Cabeceras de seguridad

`next.config.ts` añade `X-Frame-Options: DENY` y `frame-ancestors 'none'` (nadie puede
embeber Archicel para engañar a quien pulsa), `nosniff`, una política de referente que no
filtra la ruta abierta al salir a otro sitio, y una renuncia explícita a cámara, micrófono
y ubicación, que la aplicación no usa.

## Sobre cifrar: qué se puede y qué no

**Ya está cifrado lo que importa y no lo hacemos nosotros:** el tráfico va por TLS y
Firestore cifra en reposo con claves gestionadas por Google. Eso cubre a alguien que
escuche la red o que acceda a los discos.

**Lo que no se puede hacer sin romper el producto es cifrado extremo a extremo.** Si los
campos se guardaran cifrados con una clave que solo tiene el navegador, el servidor dejaría
de poder leerlos — y eso incluye:

- filtrar por rango de fechas, que es como cargan el mes y la semana;
- ordenar por fecha;
- validar la forma de los datos en las reglas, que es justo lo que se acaba de arreglar.

Habría que traerse la colección entera a cada pantalla y descifrarla en el cliente. Con una
usuaria y unos cientos de documentos funcionaría; con tres cursos de historial, no. Y
perderíamos la única barrera que impide guardar basura en la base.

**La decisión, por tanto:** no se cifra el contenido en la aplicación. Lo que protege los
datos es que solo la dueña los alcanza, y eso lo garantizan las reglas. Si algún día hay
un campo verdaderamente sensible —un diario, notas privadas— se cifra **ese campo** en el
cliente y se acepta que no se pueda buscar por él. Cifrar todo por si acaso cambiaría una
protección real por la sensación de tenerla.

## Lo que sigue siendo cierto

- **La clave web de Firebase es pública por diseño.** Va en el cliente y no es un secreto:
  identifica el proyecto, no autoriza nada. Lo que autoriza es la sesión de la usuaria.
- **El JSON de cuenta de servicio no se comparte ni se sube jamás.** Ese sí salta todas las
  reglas. No existe en este repositorio.
- `.env.local` está en `.gitignore` y verificado fuera del control de versiones.
- La cuenta no se puede borrar desde el cliente (`allow delete: if false`).

## Cómo revisar esto otra vez

```bash
# datos de la usuaria convertidos en HTML
grep -rn "dangerouslySetInnerHTML\|innerHTML" src

# secretos rastreados por git
git ls-files | grep -iE "\.env|serviceaccount|credential|\.pem|\.key"

# el comodín de las reglas no debe alcanzar las colecciones validadas
grep -n "estaValidada" firestore.rules
```

Y en las reglas, la pregunta que hay que hacerse siempre: **¿algún otro `match` permite
esto mismo sin pasar por aquí?** Si la respuesta es sí, esta validación no existe.
