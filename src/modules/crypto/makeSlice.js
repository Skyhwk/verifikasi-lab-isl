import { encryptSlice } from './Crypto';

const makeSlice = (controller, method) => {
    const obj = {
        controller,
        function: method,
        ts: Math.floor(Date.now() / 1000),
    };

    return encryptSlice(JSON.stringify(obj));
};

export default makeSlice;
