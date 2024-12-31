import 'reflect-metadata';

const t = {
    color: 'red',
};
Reflect.defineMetadata('note', 'hi', t);
const meta1 = Reflect.getMetadata('note', t);