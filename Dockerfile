# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app

# 优先拷贝依赖清单，利用层缓存
COPY package.json package-lock.json* ./
RUN npm ci --cache /tmp/npm-cache || npm install --cache /tmp/npm-cache

# 拷贝源码并构建（含 vue-tsc 严格类型检查）
COPY . .
RUN npm run build

# ---- 运行阶段：nginx 静态托管 ----
FROM nginx:1.27-alpine AS runtime

# SPA 路由回退（hash 路由也兼容 history 直链）
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
