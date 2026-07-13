import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { DownloadPrompt } from './components/download-prompt/download-prompt';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, DownloadPrompt],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
