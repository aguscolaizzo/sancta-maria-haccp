# Restaurar Sancta Maria 1187 — HACCP

Este ZIP es una copia del código y de los datos de la aplicación en la fecha indicada en `manifest.json`. Guárdalo completo y en privado: contiene trazabilidad, fotos, firmas y configuración del restaurante.

## Para Agustín

1. Conserva el ZIP descargado en tu ordenador y otra copia en un lugar seguro.
2. Si necesitás recuperar la aplicación o continuarla en otra conversación, adjuntá el ZIP y pedí: «Restaurá Sancta Maria HACCP desde este backup. Verificá manifest.json, conservá todos los datos, las firmas y las fotos. Reutilizá el proyecto existente si todavía existe. No reemplaces registros actuales sin compararlos y sin mi autorización».
3. El backup no se abre como una app Android ni se restaura al descomprimirlo. Incluye lo necesario para que un desarrollador o una nueva conversación prepare la restauración.
4. Cada descarga contiene los datos de ese momento. Los registros agregados después requieren una nueva copia.

## Contenido

- `source.zip`: código completo, recursos originales, dependencias declaradas y bloqueadas, migraciones, pruebas y scripts de construcción. `source-manifest.json` contiene el hash de cada archivo del código.
- `database.json`: tablas, filas y definiciones SQL completas. Incluye las firmas y las fotos de recepción guardadas dentro de la base, sin recortar los campos largos.
- `database.sql`: esquema y datos exportados para una base vacía.
- `media/` y `media-index.json`: todos los objetos del almacenamiento de imágenes, con su clave original, tipo y hash. También se conservan los objetos que ya no estén referenciados.
- `configuration.json`: variables de aplicación y nombres de sus conexiones. Incluye la configuración privada de importación si existe; no la publiques.
- `manifest.json`: fecha y hora UTC de captura, cantidades por tabla, lista de archivos y hashes SHA-256.
- `restore-backup.py`: comprobación del ZIP y restauración local en una carpeta NUEVA, sin conectarse a producción.

## Comprobar y recuperar los archivos localmente

Requiere Python 3.10 o posterior; no necesita instalar paquetes. Extraer únicamente `restore-backup.py` junto al ZIP y ejecutar:

```bash
python3 restore-backup.py Sancta_Maria_HACCP_Backup_Complet_FECHA.zip --check-only
python3 restore-backup.py Sancta_Maria_HACCP_Backup_Complet_FECHA.zip --output sancta-restaurado
```

La segunda orden rechaza una carpeta de destino que ya exista. Comprueba los hashes, extrae el código, reconstruye `database.sqlite`, verifica la integridad SQLite y las relaciones, compara las cantidades por tabla y deja las fotos con sus metadatos. Si falla, elimina solo la carpeta nueva que estaba creando. Nunca escribe en la app publicada.

Para importar `database.sql` manualmente en SQLite, ejecutar todo el archivo dentro de una misma transacción; el script Python ya gestiona la restauración. El SQL no incluye `BEGIN/COMMIT` explícitos porque D1 administra sus propias transacciones.

## Recuperar el mismo Site

Proyecto original: `appgprj_6a988b25a3908191bce47dcc8ad65c97`.
URL original: https://sancta-frigo.agustingcolaizzo.chatgpt.site
Conexiones lógicas: D1 `DB`; almacenamiento R2 `MEDIA`.

1. Abrir el proyecto existente y comprobar qué sigue disponible. No crear un proyecto nuevo si el original puede recuperarse.
2. Comparar la fecha del backup con la base actual. Restaurar solo el código no exige reemplazar la base de datos ni las fotos. Una versión de código antigua puede requerir compatibilidad con el esquema actual.
3. Para volver a desplegar el código, utilizar `source/`, conservar `.openai/hosting.json`, restaurar las variables de aplicación mediante la configuración segura de Sites y usar el flujo normal de construcción y publicación del proyecto. El script de preparación vuelve a generar los recursos OCR y la copia interna del código.
4. Si también se perdieron los datos, importar las tablas y los objetos mediante las herramientas autorizadas de la plataforma. El ZIP no contiene credenciales de administración de Sites y no debe usarse para eludir permisos. La restauración de la base requiere acceso de propietario y un procedimiento de importación compatible con la plataforma.
5. No convertir las filas del backup en migraciones de esquema masivas. Las migraciones de `drizzle/` son historial de esquema; una restauración de datos debe realizarse por separado.

## Migrar a otra instalación

La aplicación utiliza Node 22+, React/Vinext y Cloudflare Workers, D1 y R2. No es un plugin WordPress ni una web PHP que se pueda subir directamente a OVH.

- Preparar un alojamiento compatible con Workers/D1/R2 o adaptar explícitamente la capa de servidor.
- Reinstalar exactamente las dependencias del `package-lock.json`, regenerar los recursos OCR, construir el proyecto y revisar su configuración de ejecución. `npm run install:ci` está preparado para Linux; el entorno restaurado debe disponer de sus comandos auxiliares.
- Crear una base VACÍA e importar el esquema y los datos; conservar las identificaciones y relaciones. `database.sqlite` es una reconstrucción SQLite verificable. Para D1 se puede usar `database.sql` con el procedimiento de importación autorizado correspondiente; revisar la tabla de seguimiento de migraciones antes de aplicar migraciones otra vez.
- Volver a subir cada archivo de `media/` con la clave exacta de `media-index.json`, manteniendo sus metadatos y comprobando tamaño/hash.
- Configurar `REGISTER_OWNER_ID` y las demás variables. Si cambia el proveedor de identidad, habrá que adaptar la autenticación y mapear las identidades con cuidado. Las identidades históricas de los registros deben conservarse.
- Los QR antiguos contienen la URL original. Para que sigan funcionando, conservar el dominio/ruta original o configurar redirecciones antes de abandonar el alojamiento anterior.

## Alcance y comprobaciones finales

La base se lee en un solo lote transaccional. Los objetos se comprueban antes y después de copiarlos. No existe una transacción conjunta entre base y fotos: evitá modificar el registro durante la descarga.

No se incluyen el emparejamiento Bluetooth, preferencias guardadas solo en el teléfono, formularios sin guardar, sesiones/tokens de plataforma, recursos de alojamiento ni el contenido de un archivo externo de OneDrive. Las dependencias instaladas y recursos OCR generados se reconstruyen desde sus fuentes declaradas. Esto no elimina registros guardados de la aplicación.

Antes de dar por terminada una restauración, verificar los totales de `manifest.json`, temperaturas, lotes y fechas, etiquetas y QR, recepciones y fotos, limpieza/freidora y firmas, permisos de equipo y una impresión real. El script local realiza verificaciones de datos; no sustituye una prueba de la app restaurada en su alojamiento.
