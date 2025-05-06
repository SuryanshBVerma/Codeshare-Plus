import { Routes } from '@angular/router';
import { CodeareaComponent } from './components/codearea/codearea.component';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';

export const routes: Routes = [

    {path : "", component : LandingPageComponent},
    {path : ":code", component : CodeareaComponent}
];
