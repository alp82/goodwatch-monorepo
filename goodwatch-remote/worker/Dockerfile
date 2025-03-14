ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN uv tool install playwright==1.45.1
RUN playwright install --with-deps chromium

CMD ["windmill"]