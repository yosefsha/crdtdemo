
const d = (state:any, action:any) => {
    switch ( action.type) {
        case 'FETCH_COMMENTS':
            return action.payload;
        default:
            return state;
    }
};

export default d;