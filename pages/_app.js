import { ToastContainer } from 'react-toastify';

import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.scss';

const App = ({ Component, pageProps }) => (
  <>
    <ToastContainer autoClose={5000} />
    <Component {...pageProps} />
  </>
);

export default App;
