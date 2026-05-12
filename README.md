# ⚽ Football Analyzer

Análisis estadístico avanzado de partidos — Premier League, LaLiga, Bundesliga, Serie A, Ligue 1.

**Funcionalidades:** H2H histórico · Forma últimos 5/10/20 partidos · BTTS · Over 2.5 · Probabilidades Poisson

---

## 🚀 DESPLIEGUE SIN INSTALAR NADA — GitHub + Vercel

### PASO 1 — Crea cuenta en GitHub
1. Ve a https://github.com/signup
2. Regístrate gratis (email + contraseña)
3. Verifica tu email

### PASO 2 — Crea un repositorio nuevo
1. Una vez dentro de GitHub, haz clic en el botón verde **"New"** (esquina superior izquierda)
2. Nombre del repositorio: `football-analyzer`
3. Selecciona **Public**
4. **NO** marques ninguna casilla de inicialización
5. Haz clic en **"Create repository"**

### PASO 3 — Sube todos los archivos
1. En la página del repositorio vacío, haz clic en **"uploading an existing file"**
2. Abre el Explorador de Windows y navega a: `C:\Documents\proyectos_IA\football-analyzer`
3. Selecciona **todos los archivos y carpetas** (Ctrl+A) y arrástralos al navegador
4. Espera a que suban todos
5. Haz clic en **"Commit changes"** (botón verde abajo)

> ⚠️ GitHub puede tardar en subir carpetas anidadas. Si alguna subcarpeta no sube,
> usa "Add file → Create new file" y escribe el path completo (ej: `app/page.tsx`)

### PASO 4 — Crea cuenta en Vercel y conecta GitHub
1. Ve a https://vercel.com
2. Haz clic en **"Sign Up"** → elige **"Continue with GitHub"**
3. Autoriza Vercel para acceder a tu GitHub
4. Una vez dentro, haz clic en **"Add New Project"**
5. Verás tu repositorio `football-analyzer` → haz clic en **"Import"**
6. Vercel detecta automáticamente que es un proyecto Next.js

### PASO 5 — Añade tu API Key (¡IMPORTANTE!)
Antes de hacer clic en "Deploy", busca la sección **"Environment Variables"** y añade:
- **Name:** `FOOTBALL_DATA_KEY`
- **Value:** *pega aquí tu API key de football-data.org*
- Haz clic en **"Add"**

### PASO 6 — Despliega
1. Haz clic en el botón **"Deploy"**
2. Espera 2-3 minutos mientras construye la app
3. ¡Vercel te dará una URL pública como `football-analyzer.vercel.app`!

---

## 🔑 API Key
- Obtenida en: https://www.football-data.org/client/register (gratis)
- Variable de entorno: `FOOTBALL_DATA_KEY`
- Límite gratuito: 10 llamadas/minuto

## ⚠️ Aviso legal
Las probabilidades son estimaciones estadísticas. No constituyen asesoramiento de apuestas.
