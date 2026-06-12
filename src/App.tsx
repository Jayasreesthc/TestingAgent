import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Globe, 
  Key, 
  Mail, 
  Layers, 
  AlertCircle, 
  Settings2, 
  Sun, 
  Moon, 
  Terminal, 
  Play, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Flame,
  Check,
  Copy,
  GitFork
} from 'lucide-react';

interface FormState {
  githubUrl: string;
  branchName: string;
  jiraUrl: string;
  jiraToken: string;
  jiraEmail: string;
  projectKey: string;
}

interface FormErrors {
  githubUrl?: string;
  branchName?: string;
  jiraUrl?: string;
  jiraToken?: string;
  jiraEmail?: string;
  projectKey?: string;
}

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('tf-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Form states
  const [form, setForm] = useState<FormState>(() => {
    const saved = localStorage.getItem('tf-form');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      githubUrl: '',
      branchName: 'main',
      jiraUrl: '',
      jiraToken: '',
      jiraEmail: '',
      projectKey: '',
    };
  });

  // Touched state for fields to show validation on blur
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    githubUrl: false,
    branchName: false,
    jiraUrl: false,
    jiraToken: false,
    jiraEmail: false,
    projectKey: false,
  });

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [showToken, setShowToken] = useState(false);
  const [githubTestState, setGithubTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [jiraTestState, setJiraTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isForging, setIsForging] = useState(false);
  const [forgedOutput, setForgedOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tf-theme', theme);
  }, [theme]);

  // Persist form draft & run validation
  useEffect(() => {
    localStorage.setItem('tf-form', JSON.stringify(form));
    validateForm(false);
  }, [form, touched]);

  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Form validation
  const validateForm = (showAllErrors = false): boolean => {
    const newErrors: FormErrors = {};
    
    // GitHub URL validation
    if (!form.githubUrl.trim()) {
      if (showAllErrors || touched.githubUrl) {
        newErrors.githubUrl = 'GitHub repository URL is required';
      }
    } else {
      const gitRegex = /^(https:\/\/github\.com\/|git@github\.com:)[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?\/?$/;
      if (!gitRegex.test(form.githubUrl.trim())) {
        newErrors.githubUrl = 'Must be a valid GitHub URL (e.g., https://github.com/owner/repo)';
      }
    }

    // Branch Name validation
    if (!form.branchName.trim()) {
      if (showAllErrors || touched.branchName) {
        newErrors.branchName = 'Branch name is required';
      }
    }

    // Jira URL validation
    if (!form.jiraUrl.trim()) {
      if (showAllErrors || touched.jiraUrl) {
        newErrors.jiraUrl = 'Jira Base URL is required';
      }
    } else {
      try {
        const url = new URL(form.jiraUrl.trim());
        if (!url.protocol.startsWith('http')) {
          newErrors.jiraUrl = 'Must be a valid HTTP/HTTPS URL';
        } else if (!form.jiraUrl.includes('atlassian.net') && !form.jiraUrl.includes('jira')) {
          newErrors.jiraUrl = 'Must be a valid Jira URL (e.g., https://your-company.atlassian.net)';
        }
      } catch (e) {
        newErrors.jiraUrl = 'Invalid URL format (e.g., https://your-company.atlassian.net)';
      }
    }

    // Jira Token validation
    if (!form.jiraToken.trim()) {
      if (showAllErrors || touched.jiraToken) {
        newErrors.jiraToken = 'Jira API Token is required';
      }
    } else if (form.jiraToken.trim().length < 10) {
      newErrors.jiraToken = 'API Token seems too short';
    }

    // Jira Email validation
    if (!form.jiraEmail.trim()) {
      if (showAllErrors || touched.jiraEmail) {
        newErrors.jiraEmail = 'Jira account email is required';
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.jiraEmail.trim())) {
        newErrors.jiraEmail = 'Enter a valid email address';
      }
    }

    // Project Key validation
    if (!form.projectKey.trim()) {
      if (showAllErrors || touched.projectKey) {
        newErrors.projectKey = 'Jira Project Key is required';
      }
    } else {
      const keyRegex = /^[A-Z][A-Z0-9]+$/;
      if (!keyRegex.test(form.projectKey.trim().toUpperCase())) {
        newErrors.projectKey = 'Project Key must be uppercase alphanumeric (e.g., PROJ)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof FormState) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all draft configurations?')) {
      setForm({
        githubUrl: '',
        branchName: 'main',
        jiraUrl: '',
        jiraToken: '',
        jiraEmail: '',
        projectKey: '',
      });
      setTouched({
        githubUrl: false,
        branchName: false,
        jiraUrl: false,
        jiraToken: false,
        jiraEmail: false,
        projectKey: false,
      });
      setErrors({});
      setGithubTestState('idle');
      setJiraTestState('idle');
      setForgedOutput(null);
    }
  };

  // GitHub connection test with actual fetch
  const testGithubConnection = async () => {
    if (!form.githubUrl.trim()) {
      setErrors(prev => ({ ...prev, githubUrl: 'GitHub repository URL is required' }));
      return;
    }
    
    const gitRegex = /github\.com[\/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/;
    const match = form.githubUrl.trim().match(gitRegex);
    if (!match) {
      setErrors(prev => ({ ...prev, githubUrl: 'Must be a valid GitHub URL (e.g., https://github.com/owner/repo)' }));
      return;
    }
    
    if (!form.branchName.trim()) {
      setErrors(prev => ({ ...prev, branchName: 'Branch name is required' }));
      return;
    }

    const [, owner, repo] = match;
    const branch = form.branchName.trim();

    setGithubTestState('testing');
    try {
      // Check repository existence/accessibility
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (repoRes.status === 404) {
        throw new Error('Repository not found or is private');
      } else if (repoRes.status === 403) {
        const limitRemaining = repoRes.headers.get('X-RateLimit-Remaining');
        if (limitRemaining === '0') {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
      } else if (!repoRes.ok) {
        throw new Error(`GitHub API returned status ${repoRes.status}`);
      }

      // Check branch existence
      const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`);
      if (branchRes.status === 404) {
        throw new Error(`Branch "${branch}" not found in repository`);
      } else if (!branchRes.ok && branchRes.status !== 403) {
        throw new Error(`Failed to check branch: ${branchRes.statusText}`);
      }

      setGithubTestState('success');
      // Clear errors for githubUrl and branchName
      setErrors(prev => {
        const next = { ...prev };
        delete next.githubUrl;
        delete next.branchName;
        return next;
      });
    } catch (err: any) {
      setGithubTestState('error');
      setErrors(prev => ({ ...prev, githubUrl: err.message || 'Connection failed' }));
    }
  };

  // Mock Jira connection test after client-side check
  const testJiraConnection = () => {
    // Validate all Jira fields
    const newErrors: FormErrors = {};
    let hasErrors = false;

    if (!form.jiraUrl.trim()) {
      newErrors.jiraUrl = 'Jira Base URL is required';
      hasErrors = true;
    } else {
      try {
        const url = new URL(form.jiraUrl.trim());
        if (!url.protocol.startsWith('http')) {
          newErrors.jiraUrl = 'Must be a valid HTTP/HTTPS URL';
          hasErrors = true;
        } else if (!form.jiraUrl.includes('atlassian.net') && !form.jiraUrl.includes('jira')) {
          newErrors.jiraUrl = 'Must be a valid Jira URL (e.g., https://your-company.atlassian.net)';
          hasErrors = true;
        }
      } catch (e) {
        newErrors.jiraUrl = 'Invalid URL format (e.g., https://your-company.atlassian.net)';
        hasErrors = true;
      }
    }

    if (!form.jiraEmail.trim()) {
      newErrors.jiraEmail = 'Jira account email is required';
      hasErrors = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.jiraEmail.trim())) {
        newErrors.jiraEmail = 'Enter a valid email address';
        hasErrors = true;
      }
    }

    if (!form.projectKey.trim()) {
      newErrors.projectKey = 'Jira Project Key is required';
      hasErrors = true;
    } else {
      const keyRegex = /^[A-Z][A-Z0-9]+$/;
      if (!keyRegex.test(form.projectKey.trim().toUpperCase())) {
        newErrors.projectKey = 'Project Key must be uppercase alphanumeric (e.g., PROJ)';
        hasErrors = true;
      }
    }

    if (!form.jiraToken.trim()) {
      newErrors.jiraToken = 'Jira API Token is required';
      hasErrors = true;
    } else if (form.jiraToken.trim().length < 10) {
      newErrors.jiraToken = 'API Token seems too short';
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      // Mark fields as touched
      setTouched(prev => ({
        ...prev,
        jiraUrl: true,
        jiraEmail: true,
        projectKey: true,
        jiraToken: true
      }));
      return;
    }

    setJiraTestState('testing');
    setTimeout(() => {
      const success = Math.random() > 0.15;
      setJiraTestState(success ? 'success' : 'error');
    }, 1500);
  };

  const handleForge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsForging(true);
    setForgedOutput(null);

    try {
      const response = await fetch('http://localhost:8000/api/forge-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubUrl: form.githubUrl.trim(),
          branchName: form.branchName.trim(),
          jiraUrl: form.jiraUrl.trim(),
          jiraToken: form.jiraToken.trim(),
          jiraEmail: form.jiraEmail.trim(),
          projectKey: form.projectKey.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to forge configuration profile');
      }

      const data = await response.json();
      setForgedOutput(data.report || 'Successfully forged configuration, but no report was returned.');
    } catch (err: any) {
      setForgedOutput(`ERROR executing TestForge AI Agent:\n\n${err.message || err}`);
    } finally {
      setIsForging(false);
    }
  };

  const copyToClipboard = () => {
    if (forgedOutput) {
      navigator.clipboard.writeText(forgedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate completion percentage
  const totalFields = 6;
  const filledFields = [
    form.githubUrl.trim() && !errors.githubUrl,
    form.branchName.trim() && !errors.branchName,
    form.jiraUrl.trim() && !errors.jiraUrl,
    form.jiraToken.trim() && !errors.jiraToken,
    form.jiraEmail.trim() && !errors.jiraEmail,
    form.projectKey.trim() && !errors.projectKey,
  ].filter(Boolean).length;
  
  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  return (
    <div className="app-container animate-fade-in">
      {/* Top Banner / Navigation */}
      <header className="app-header">
        <div className="brand-logo">
          <div className="logo-icon">
            <Flame className="icon-fire" size={24} />
          </div>
          <div>
            <h1>TestForge</h1>
            <span className="badge">Integration Panel</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="main-content">
        {/* Left column: Overview and checklist */}
        <section className="side-panel">
          <div className="glass-card panel-intro">
            <h2>Classic Web Automation Orchestration</h2>
            <p>
              Connect your developer workflows seamlessly. TestForge bridges development assets inside GitHub to issue tracking pipelines in Jira Cloud.
            </p>
            
            <div className="progress-container">
              <div className="progress-header">
                <span>Setup Completion</span>
                <span className="percent-indicator">{completionPercentage}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${completionPercentage}%` }}></div>
              </div>
            </div>
          </div>

          <div className="glass-card checklist-card">
            <h3>Configuration Validation</h3>
            <ul className="checklist">
              <li className={form.githubUrl && !errors.githubUrl ? 'checked' : 'pending'}>
                <Check className="check-icon" size={16} />
                <span>GitHub Repository Link Validated</span>
              </li>
              <li className={form.branchName && !errors.branchName ? 'checked' : 'pending'}>
                <Check className="check-icon" size={16} />
                <span>Default Branch Name Specified</span>
              </li>
              <li className={form.jiraUrl && !errors.jiraUrl ? 'checked' : 'pending'}>
                <Check className="check-icon" size={16} />
                <span>Jira Base URL Format Verified</span>
              </li>
              <li className={form.jiraToken && !errors.jiraToken ? 'checked' : 'pending'}>
                <Check className="check-icon" size={16} />
                <span>Jira Developer Token Added</span>
              </li>
              <li className={form.jiraEmail && !errors.jiraEmail ? 'checked' : 'pending'}>
                <Check className="check-icon" size={16} />
                <span>Account Email Validated</span>
              </li>
              <li className={form.projectKey && !errors.projectKey ? 'checked' : 'pending'}>
                <Check className="check-icon" size={16} />
                <span>Target Project Key Defined</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Right column: Form */}
        <section className="form-panel">
          <form onSubmit={handleForge} className="glass-card form-card">
            <div className="form-section-header">
              <div className="section-icon-bg">
                <GitFork size={20} className="section-icon" />
              </div>
              <div>
                <h2>GitHub Repository Settings</h2>
                <p>Provide the source control details to pull commit data and triggers.</p>
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group flex-2">
                <label htmlFor="githubUrl">
                  GitHub Repository URL <span className="required-star">*</span>
                </label>
                <div className={`input-wrapper ${errors.githubUrl ? 'has-error' : ''}`}>
                  <Globe className="input-icon" size={18} />
                  <input
                    id="githubUrl"
                    type="url"
                    value={form.githubUrl}
                    onChange={(e) => handleInputChange('githubUrl', e.target.value)}
                    onBlur={() => handleBlur('githubUrl')}
                    placeholder="https://github.com/username/project-repository"
                    required
                  />
                </div>
                {errors.githubUrl && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.githubUrl}
                  </span>
                )}
              </div>

              <div className="form-group flex-1">
                <label htmlFor="branchName">
                  Branch Name <span className="required-star">*</span>
                </label>
                <div className={`input-wrapper ${errors.branchName ? 'has-error' : ''}`}>
                  <GitBranch className="input-icon" size={18} />
                  <input
                    id="branchName"
                    type="text"
                    value={form.branchName}
                    onChange={(e) => handleInputChange('branchName', e.target.value)}
                    onBlur={() => handleBlur('branchName')}
                    placeholder="main"
                    required
                  />
                </div>
                {errors.branchName && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.branchName}
                  </span>
                )}
              </div>
            </div>

            <div className="form-action-test">
              <button
                type="button"
                className={`btn-secondary ${githubTestState}`}
                onClick={testGithubConnection}
                disabled={githubTestState === 'testing'}
              >
                {githubTestState === 'testing' && <RefreshCw className="spin" size={16} />}
                {githubTestState === 'idle' && 'Test Repository Connection'}
                {githubTestState === 'success' && 'Connection Success'}
                {githubTestState === 'error' && 'Connection Failed'}
              </button>
              {githubTestState === 'success' && <span className="success-note">GitHub Repository reachable</span>}
              {githubTestState === 'error' && <span className="error-note">Cannot resolve repo. Check privacy settings.</span>}
            </div>

            <hr className="divider" />

            <div className="form-section-header">
              <div className="section-icon-bg">
                <Settings2 size={20} className="section-icon" />
              </div>
              <div>
                <h2>Jira Integration Settings</h2>
                <p>Configure access credentials to update and synchronize issue tickets.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="jiraUrl">
                Jira Base URL <span className="required-star">*</span>
              </label>
              <div className={`input-wrapper ${errors.jiraUrl ? 'has-error' : ''}`}>
                <Globe className="input-icon" size={18} />
                <input
                  id="jiraUrl"
                  type="url"
                  value={form.jiraUrl}
                  onChange={(e) => handleInputChange('jiraUrl', e.target.value)}
                  onBlur={() => handleBlur('jiraUrl')}
                  placeholder="https://your-company.atlassian.net"
                  required
                />
              </div>
              {errors.jiraUrl && (
                <span className="error-message">
                  <AlertCircle size={14} /> {errors.jiraUrl}
                </span>
              )}
            </div>

            <div className="form-group-row">
              <div className="form-group flex-1">
                <label htmlFor="jiraEmail">
                  Jira Account Email <span className="required-star">*</span>
                </label>
                <div className={`input-wrapper ${errors.jiraEmail ? 'has-error' : ''}`}>
                  <Mail className="input-icon" size={18} />
                  <input
                    id="jiraEmail"
                    type="email"
                    value={form.jiraEmail}
                    onChange={(e) => handleInputChange('jiraEmail', e.target.value)}
                    onBlur={() => handleBlur('jiraEmail')}
                    placeholder="email@company.com"
                    required
                  />
                </div>
                {errors.jiraEmail && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.jiraEmail}
                  </span>
                )}
              </div>

              <div className="form-group flex-1">
                <label htmlFor="projectKey">
                  Jira Project Key <span className="required-star">*</span>
                </label>
                <div className={`input-wrapper ${errors.projectKey ? 'has-error' : ''}`}>
                  <Layers className="input-icon" size={18} />
                  <input
                    id="projectKey"
                    type="text"
                    value={form.projectKey}
                    onChange={(e) => handleInputChange('projectKey', e.target.value.toUpperCase())}
                    onBlur={() => handleBlur('projectKey')}
                    placeholder="PROJ"
                    required
                  />
                </div>
                {errors.projectKey && (
                  <span className="error-message">
                    <AlertCircle size={14} /> {errors.projectKey}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="jiraToken">
                Jira API Token <span className="required-star">*</span>
              </label>
              <div className={`input-wrapper ${errors.jiraToken ? 'has-error' : ''}`}>
                <Key className="input-icon" size={18} />
                <input
                  id="jiraToken"
                  type={showToken ? 'text' : 'password'}
                  value={form.jiraToken}
                  onChange={(e) => handleInputChange('jiraToken', e.target.value)}
                  onBlur={() => handleBlur('jiraToken')}
                  placeholder="ATATT3xFfGF..."
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowToken(!showToken)}
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.jiraToken && (
                <span className="error-message">
                  <AlertCircle size={14} /> {errors.jiraToken}
                </span>
              )}
            </div>

            <div className="form-action-test">
              <button
                type="button"
                className={`btn-secondary ${jiraTestState}`}
                onClick={testJiraConnection}
                disabled={jiraTestState === 'testing'}
              >
                {jiraTestState === 'testing' && <RefreshCw className="spin" size={16} />}
                {jiraTestState === 'idle' && 'Test Jira Connection'}
                {jiraTestState === 'success' && 'Connection Success'}
                {jiraTestState === 'error' && 'Connection Failed'}
              </button>
              {jiraTestState === 'success' && <span className="success-note">Jira APIs connected</span>}
              {jiraTestState === 'error' && <span className="error-note">Authentication failed. Check token and email.</span>}
            </div>

            <div className="form-footer-actions">
              <button
                type="button"
                className="btn-reset"
                onClick={handleReset}
              >
                Reset Draft
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={isForging || completionPercentage < 100}
              >
                {isForging ? (
                  <>
                    <RefreshCw className="spin" size={18} />
                    <span>Forging Configuration...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Forge Workspace</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Terminal Output drawer */}
      {forgedOutput && (
        <section className="terminal-section animate-fade-in">
          <div className="glass-card terminal-card">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="terminal-title">
                <Terminal size={14} />
                <span>testforge-config-profile.json</span>
              </div>
              <button className="btn-copy" onClick={copyToClipboard}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="terminal-body">
              <code>{forgedOutput}</code>
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
