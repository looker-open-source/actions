FROM node:10.8.0
RUN mkdir -p /code
WORKDIR /code
ADD . /code

RUN npm install -g -s --no-progress yarn
RUN yarn install --production

CMD ["yarn","start"]

EXPOSE 80
