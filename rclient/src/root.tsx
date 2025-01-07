import  { Provider } from 'react-redux';
import store from './store';
import React from 'react';

interface Props {
    children: React.ReactNode;
}

const Root: React.FC<Props> = (props) => {
    return (
        <Provider store={store}>
            {props.children}
        </Provider>
    );
}

export default Root;