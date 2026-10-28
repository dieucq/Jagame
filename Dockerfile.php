FROM php:8.2-cli-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libfreetype6-dev libzip-dev libonig-dev libsqlite3-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j2 gd zip mbstring pdo_sqlite \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=10001:10001 . /app
RUN mkdir -p /app/database /app/uploads /app/games /app/application/logs /app/application/cache \
 && chown -R 10001:10001 /app/database /app/uploads /app/games /app/application/logs /app/application/cache
USER 10001:10001
EXPOSE 6968
CMD ["php","-S","0.0.0.0:6968","router.php"]
