FROM php:8.2-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
        curl \
    libcurl4-openssl-dev \
    libzip-dev \
    unzip \
        && docker-php-ext-install curl opcache pdo_mysql pcntl sockets \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN { \
        echo 'opcache.enable=1'; \
        echo 'opcache.enable_cli=1'; \
        echo 'opcache.validate_timestamps=0'; \
        echo 'opcache.memory_consumption=128'; \
        echo 'opcache.max_accelerated_files=10000'; \
    } > /usr/local/etc/php/conf.d/opcache-recommended.ini

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install PHP dependencies first (cached layer)
COPY composer.json composer.lock* ./
RUN composer install --no-dev --prefer-dist --no-progress --optimize-autoloader --classmap-authoritative --no-interaction

# Copy application files
COPY . .

# Ensure uploads directory exists
RUN mkdir -p /app/uploads

EXPOSE 5100 5101

CMD ["php", "start.php", "start"]
