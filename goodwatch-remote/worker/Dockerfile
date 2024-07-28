ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN pip install playwright==1.45.1
RUN playwright install --with-deps chromium

CMD ["windmill"]