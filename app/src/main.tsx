import { render } from 'preact';
import './styles/base.css';
import './styles/tree.css';
import './styles/screens.css';
import './styles/dialogs.css';
import './styles/print.css';
import './styles/about.css';
import { App } from './app.tsx';

render(<App />, document.getElementById('app')!);
