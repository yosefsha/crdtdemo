import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducers';

const createStore = (preloadedState?: any) => {
    return configureStore({
    reducer: rootReducer,
    preloadedState
    })
};

export default createStore;