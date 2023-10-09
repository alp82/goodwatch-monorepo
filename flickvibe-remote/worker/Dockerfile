ARG WM_IMAGE
FROM ${WM_IMAGE}

RUN apt-get update
RUN pip install playwright
RUN playwright install
#RUN playwright install-deps

CMD ["windmill"]