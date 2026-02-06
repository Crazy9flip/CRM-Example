# postgres:17.6-alpine3.22
# python:3.12.12-slim
# nginx:1.29-alpine3.22

FROM nginx:1.29-alpine3.22
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]