import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import React from 'react';
import PrayerTimes from './components/PrayerTimes';




const App = () => {
  return (
    <div>
      <h1> The Prayers of the day </h1>
      <PrayerTimes />
    </div>
  );
};

export default App
