ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN pip install playwright
RUN playwright install
RUN playwright install-deps

CMD ["windmill"]