import express , {Request, Response} from 'express';
import {router as loginRouter} from './routes/loginRoutes';
import bodyParser from 'body-parser';
import cookieSession from 'cookie-session';
// import cookieSession from 'express-session';
const port = process.env.PORT || 3001;

const app = express();

// app.use(express.json()); // middleware to parse json
// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Use cookie-session middleware
app.use(cookieSession({keys: ['asdf'],
     maxAge: 24 * 60 * 60 * 1000,
     secure: false,
     name: 'session'

    }));
// use the router
app.use(loginRouter);
// app.use(cookieSession({
//     name: '',
//     secret


// app.get('/', (req: Request, res: Response) => {
//    console.log('server got a request',req.url);
//   res.send(`<h1>hello from server</h1>`);
// });
app.listen(port, () => console.log(`Server is listening on ${port}!`));
