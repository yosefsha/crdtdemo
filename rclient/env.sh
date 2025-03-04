#!/bin/sh

# Inject environment variables into a JS file
echo "window._env_ = {" > /usr/share/nginx/html/env.js
echo "  REACT_APP_API_URL: \"$REACT_APP_API_URL\"," >> /usr/share/nginx/html/env.js
echo "};" >> /usr/share/nginx/html/env.js

# Pass control to the original command (Nginx)
exec "$@"
