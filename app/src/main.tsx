import { render } from 'preact';
import './styles/base.css';
import './styles/tree.css';
import './styles/screens.css';
import './styles/dialogs.css';
import './styles/print.css';
import './styles/about.css';
import { App } from './app.tsx';
import { hasCurrentConsent, requestPersistentStorage } from './legal';

// Ask the browser to keep this site's storage (also asked right after agreeing to the terms).
if (hasCurrentConsent()) requestPersistentStorage();

render(<App />, document.getElementById('app')!);
