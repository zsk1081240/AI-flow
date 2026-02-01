/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface HeaderProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleDarkMode }) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 glass-panel px-4 py-2 rounded-full mt-4 shadow-lg shadow-black/20">
          <div className="relative group cursor-default">
            <div className="relative h-8 w-8 bg-gradient-to-br from-indigo-500 via-ai-accent to-purple-600 rounded-lg flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                <span className="text-white font-black text-xs tracking-tighter select-none">HZ</span>
            </div>
          </div>
          <h1 className="text-sm font-bold text-gray-200 tracking-wide font-sans select-none">
              HZ-AI Studio
          </h1>
      </div>
    </header>
  );
};

export default Header;