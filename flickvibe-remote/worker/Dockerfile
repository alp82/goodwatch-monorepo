ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN pip install playwright
RUN playwright install --with-deps chromium

CMD ["windmill"]