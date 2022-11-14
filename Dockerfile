FROM node:18.12.1

RUN mkdir -p /code
WORKDIR /code

COPY . /code

RUN yarn install --production && yarn cache clean
RUN yarn build

CMD ["yarn","start"]

EXPOSE 8080
