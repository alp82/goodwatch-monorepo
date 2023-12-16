ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN pip install playwright==1.40.0
RUN playwright install --with-deps chromium

CMD ["windmill"]