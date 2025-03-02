ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN apt-get update && apt-get install -y python3-pip
RUN pip install --break-system-packages playwright==1.45.1
RUN playwright install --with-deps chromium

CMD ["windmill"]