FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args for env vars baked into the Next.js build
ARG NEXT_PUBLIC_API_URL=http://localhost:8100
ARG NEXT_PUBLIC_APP_NAME=StepScribe

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production stage: serve static export via nginx ---
FROM nginx:alpine AS runner

COPY --from=builder /app/out /usr/share/nginx/html

# Support client-side routing — return index.html for unknown paths
RUN printf 'server {\n\
  listen 3000;\n\
  root /usr/share/nginx/html;\n\
  location / {\n\
    try_files $uri $uri/ $uri/index.html /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
