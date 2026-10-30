# Etapa 1: build de la app (Vite genera la carpeta dist/)
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite reemplaza import.meta.env en build-time: las variables deben existir aca.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Etapa 2: servidor estatico nginx
FROM nginx:1.27-alpine

# Configuracion con rewrite para rutas sin extension y proxy /api hacia el backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
