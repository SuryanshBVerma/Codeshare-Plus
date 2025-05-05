import { Routes } from '@angular/router';
import { CodeareaComponent } from './components/codearea/codearea.component';

export const routes: Routes = [

    {path : "", component : CodeareaComponent},
    {path : ":code", component : CodeareaComponent}
];
