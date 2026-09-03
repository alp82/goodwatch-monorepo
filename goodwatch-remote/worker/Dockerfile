ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN uv tool install playwright==1.62.0
RUN playwright install --with-deps chromium

CMD ["windmill"]
