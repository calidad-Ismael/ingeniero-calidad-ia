================================================================================
  INGENIERO DE CALIDAD IA — Guía de Instalación y Deploy
  Aplicación de Gestión de Calidad Industrial con IA
================================================================================

ÍNDICE
------
1. Requisitos previos
2. Crear cuenta y configurar Supabase
3. Crear las tablas SQL en Supabase
4. Obtener API Key de Anthropic
5. Configurar el archivo .env
6. Instalar dependencias Python
7. Correr la app en local
8. Deploy del frontend en Netlify
9. Deploy del servidor en Railway
10. Solución de problemas


================================================================================
1. REQUISITOS PREVIOS
================================================================================

- Python 3.10 o superior (https://www.python.org/downloads/)
  → En la instalación, tildar "Add Python to PATH"
- Cuenta gratuita en Supabase (https://supabase.com)
- Cuenta en Anthropic Console (https://console.anthropic.com)
- Navegador web moderno (Chrome, Firefox, Edge)


================================================================================
2. CREAR CUENTA Y CONFIGURAR SUPABASE
================================================================================

1. Ir a https://supabase.com y hacer clic en "Start for free"
2. Registrarse con GitHub o email
3. Hacer clic en "New project"
4. Elegir nombre: "ingeniero-calidad-ia" (o el que prefieran)
5. Elegir región: South America (São Paulo) para menor latencia
6. Crear una contraseña segura para la base de datos y GUARDARLA
7. Esperar ~2 minutos a que se inicialice el proyecto

Para obtener las credenciales:
1. En el panel de Supabase, ir a Settings → API
2. Copiar "Project URL" → será SUPABASE_URL en el .env
3. Copiar "anon public" key → será SUPABASE_ANON_KEY en el .env

Para habilitar Storage:
1. Ir a Storage en el menú lateral
2. Crear un bucket llamado "documentos"
3. En la configuración del bucket, habilitarlo como "Public"


================================================================================
3. CREAR LAS TABLAS SQL EN SUPABASE
================================================================================

En Supabase, ir a SQL Editor y ejecutar el siguiente SQL:

--- INICIO DEL SQL ---

-- Tabla de documentos vigentes
CREATE TABLE IF NOT EXISTS documentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,  -- 'pdf', 'word', 'excel'
    categoria TEXT,
    storage_path TEXT,
    storage_url TEXT,
    tamano BIGINT,
    version TEXT DEFAULT '1',
    codigo TEXT,
    contenido_texto TEXT,  -- texto extraído para contexto de IA
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de documentos obsoletos
CREATE TABLE IF NOT EXISTS documentos_obsoletos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    documento_id UUID,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    categoria TEXT,
    storage_path TEXT,
    storage_url TEXT,
    motivo TEXT,
    version_anterior TEXT,
    obsoleto_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de hallazgos de auditoría
CREATE TABLE IF NOT EXISTS hallazgos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clausula_fssc TEXT NOT NULL,
    area TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('NC Mayor', 'NC Menor', 'Observación', 'Conforme')),
    fecha DATE NOT NULL,
    descripcion TEXT NOT NULL,
    evidencia TEXT,
    estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_proceso', 'cerrado')),
    accion_correctiva JSONB,  -- {causa_raiz, accion_inmediata, accion_correctiva, responsable, verificacion}
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ
);

-- Tabla de mails procesados
CREATE TABLE IF NOT EXISTS mails_procesados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    texto_recibido TEXT NOT NULL,
    remitente TEXT,
    asunto TEXT,
    respuesta_generada TEXT,
    documentos_generados JSONB DEFAULT '[]',  -- [{nombre, tipo, storage_path}]
    procesado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_hallazgos_tipo ON hallazgos(tipo);
CREATE INDEX IF NOT EXISTS idx_hallazgos_estado ON hallazgos(estado);
CREATE INDEX IF NOT EXISTS idx_mails_procesado_en ON mails_procesados(procesado_en DESC);

-- Base de conocimiento de la empresa (memoria que la IA usa como contexto)
CREATE TABLE IF NOT EXISTS conocimiento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    categoria TEXT DEFAULT 'General',
    contenido TEXT NOT NULL,
    origen TEXT DEFAULT 'manual',
    documento_nombre TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas adicionales usadas por la app
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS carpeta TEXT DEFAULT 'General';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS contenido_texto TEXT;
ALTER TABLE documentos_obsoletos ADD COLUMN IF NOT EXISTS carpeta TEXT DEFAULT 'General';

-- Desactivar RLS (app interna)
ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_obsoletos DISABLE ROW LEVEL SECURITY;
ALTER TABLE hallazgos DISABLE ROW LEVEL SECURITY;
ALTER TABLE mails_procesados DISABLE ROW LEVEL SECURITY;
ALTER TABLE conocimiento DISABLE ROW LEVEL SECURITY;

--- FIN DEL SQL ---

Hacer clic en "Run" para ejecutar.
Si todo salió bien, ver las tablas en Table Editor.


================================================================================
4. OBTENER API KEY DE ANTHROPIC
================================================================================

1. Ir a https://console.anthropic.com
2. Registrarse o iniciar sesión
3. Ir a Settings → API Keys
4. Hacer clic en "Create Key"
5. Darle un nombre: "ingeniero-calidad-ia"
6. COPIAR la key generada (empieza con "sk-ant-...")
   ⚠️ Solo se muestra una vez, no se puede recuperar después


================================================================================
5. CONFIGURAR EL ARCHIVO .ENV
================================================================================

Abrir el archivo ".env" en la carpeta del proyecto con el Bloc de Notas
y reemplazar los placeholders con los valores reales:

SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...

Guardar el archivo.


================================================================================
6. INSTALAR DEPENDENCIAS PYTHON
================================================================================

Abrir una terminal (cmd o PowerShell) en la carpeta del proyecto y ejecutar:

    pip install -r requirements.txt

Esto instala: FastAPI, Uvicorn, Supabase, python-docx, openpyxl, reportlab, Anthropic SDK.

Si hay errores con reportlab en Windows:
    pip install reportlab --upgrade


================================================================================
7. CORRER LA APP EN LOCAL
================================================================================

OPCIÓN A — Doble clic en "iniciar.bat" (más fácil)
  El script instala dependencias, inicia el servidor y abre el navegador.

OPCIÓN B — Manual
  1. Abrir terminal en la carpeta del proyecto
  2. Ejecutar: python -m uvicorn servidor:app --host 127.0.0.1 --port 8000 --reload
  3. Abrir en el navegador: app.html (doble clic sobre el archivo)

El servidor queda corriendo en http://localhost:8000
La documentación automática de la API está en http://localhost:8000/docs


================================================================================
8. DEPLOY DEL FRONTEND EN NETLIFY
================================================================================

1. Crear cuenta gratuita en https://netlify.com
2. Desde el panel, hacer clic en "Add new site" → "Deploy manually"
3. Arrastrar la carpeta "aplicacion insuter" completa al área de deploy
   (o conectar con GitHub si el proyecto está subido ahí)
4. Netlify asigna una URL del tipo: https://nombre-random.netlify.app
5. Para dominio personalizado: Sites → su-sitio → Domain settings

⚠️ IMPORTANTE: Después de deployar en Railway (paso 9), actualizar la
variable API_BASE en app.html con la URL pública de Railway:
    const API_BASE = 'https://su-app.railway.app';


================================================================================
9. DEPLOY DEL SERVIDOR EN RAILWAY
================================================================================

1. Crear cuenta en https://railway.app (se puede usar con GitHub)
2. Hacer clic en "New Project" → "Deploy from GitHub repo"
3. Subir el proyecto a GitHub primero, o usar "Empty project" y Railway CLI
4. En la configuración del proyecto, ir a Variables y agregar:
   - SUPABASE_URL = (su URL de Supabase)
   - SUPABASE_ANON_KEY = (su anon key)
   - ANTHROPIC_API_KEY = (su API key de Anthropic)
5. Railway detecta automáticamente el Procfile y despliega el servidor
6. Copiar la URL pública generada (ej: https://ingeniero-calidad.railway.app)
7. Actualizar API_BASE en app.html con esa URL

Plan gratuito de Railway: 500 horas/mes de ejecución (suficiente para uso interno).

--------------------------------------------------------------------------------
SERVIDOR DE CONVERSIÓN (Word -> PDF exacto + edición de Word)
--------------------------------------------------------------------------------
La app funciona casi entera en el navegador. El único componente que necesita
servidor es la CONVERSIÓN EXACTA de Word a PDF (con LibreOffice) y la EDICIÓN
de Word preservando formato. Esto vive en servidor.py y se despliega en Railway
usando el Dockerfile incluido (que instala LibreOffice).

Pasos:
1. En Railway: New Project -> Deploy from GitHub repo (este repositorio)
2. Railway detecta el Dockerfile automáticamente (railway.json -> builder DOCKERFILE)
   y construye la imagen con LibreOffice. La primera build tarda unos minutos.
3. Cuando termine, Railway da una URL pública (ej: https://xxx.up.railway.app)
4. Verificá que funciona abriendo esa URL: debe responder
   {"servicio": "...", "libreoffice": true}
5. En la app (app.html), abrí Configuración (⚙) y pegá esa URL en el campo
   "URL del servidor de conversión (Railway)". Guardá.
6. Listo: al seleccionar un documento Word en el módulo Documentos aparecen
   las herramientas "Convertir a PDF exacto" y "Editar con IA".

Notas:
- Este servidor NO usa Supabase ni Anthropic; no necesita variables de entorno.
- Si dejás el campo vacío en la app, las funciones de Word quedan deshabilitadas
  y el resto de la app sigue funcionando normalmente.

ALTERNATIVA — Render.com:
1. Crear cuenta en https://render.com
2. New → Web Service → conectar repositorio GitHub
3. Build Command: pip install -r requirements.txt
4. Start Command: uvicorn servidor:app --host 0.0.0.0 --port $PORT
5. Agregar las variables de entorno en la sección Environment


================================================================================
10. SOLUCIÓN DE PROBLEMAS
================================================================================

"ModuleNotFoundError: No module named 'fastapi'"
→ Ejecutar: pip install -r requirements.txt

"Connection refused" al usar la app
→ Verificar que el servidor esté corriendo (iniciar.bat o uvicorn)
→ El servidor debe estar en http://localhost:8000

"Invalid API Key" en consultas de IA
→ Verificar ANTHROPIC_API_KEY en el archivo .env
→ La key debe empezar con "sk-ant-"

"Supabase error" al subir documentos
→ Verificar SUPABASE_URL y SUPABASE_ANON_KEY en .env
→ Verificar que el bucket "documentos" existe y es público
→ Verificar que las tablas fueron creadas correctamente

"CORS error" en el navegador
→ El servidor debe estar corriendo antes de abrir app.html
→ Verificar que API_BASE en app.html apunta al servidor correcto

Los archivos generados (Word, Excel, PDF) no se descargan
→ Verificar que el navegador permite descargas automáticas del sitio
→ En Chrome: Configuración → Privacidad → Configuración del sitio → Descargas

Para soporte adicional:
→ Revisar logs del servidor en la terminal donde corre uvicorn
→ Abrir las herramientas de desarrollador del navegador (F12) → Console


================================================================================
  Desarrollado para INSUTER — Sistema de Gestión de Calidad con IA
  Módulos: Consultas IA | Documentos | Generador | Mails | Obsoletos | Auditoría
================================================================================
