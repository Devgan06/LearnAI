

import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:8000";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  const [uploadMessage, setUploadMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);

  const [question, setQuestion] = useState("");
  const [tutorTopic, setTutorTopic] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const [quizTopic, setQuizTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizError, setQuizError] = useState("");

  const navigation = [
    { name: "Dashboard", icon: "⌂" },
    { name: "My Documents", icon: "▤" },
    { name: "AI Tutor", icon: "✧" },
    { name: "Practice Quiz", icon: "▣" },
    { name: "My Progress", icon: "◷" },
  ];

  const selectedCount = selectedDocuments.length;
  const hasDocuments = documents.length > 0;

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API}/documents`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load documents");
      }

      const loadedDocuments = data.documents || [];
      setDocuments(loadedDocuments);

      setSelectedDocuments((previous) => {
        const availableIds = loadedDocuments.map(
          (document) => document.document_id
        );

        const retained = previous.filter((id) =>
          availableIds.includes(id)
        );

        return retained.length > 0 ? retained : availableIds;
      });
    } catch (error) {
      console.error("Document loading error:", error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Delete a document from the backend and refresh the library.
  const handleDeleteDocument = async (document) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${document.filename}"?`
    );

    if (!confirmed) return;

    setDeletingDocumentId(document.document_id);
    setUploadMessage("");

    try {
      const response = await fetch(
        `${API}/documents/${encodeURIComponent(document.document_id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to delete document");
      }

      setSelectedDocuments((previous) =>
        previous.filter((id) => id !== document.document_id)
      );

      await fetchDocuments();

      setUploadMessage(
        `${document.filename} deleted successfully.`
      );
    } catch (error) {
      alert(error.message);
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadMessage("Please select at least one PDF.");
      return;
    }

    setLoading(true);
    setUploadMessage("");

    let successfulUploads = 0;
    const errors = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch(`${API}/upload-pdf`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.detail || "Upload failed");
          }

          successfulUploads++;
        } catch (error) {
          errors.push(`${file.name}: ${error.message}`);
        }
      }

      await fetchDocuments();
      setFiles([]);

      if (successfulUploads > 0) {
        setUploadMessage(
          `Successfully processed ${successfulUploads} PDF(s).`
        );
      }

      if (errors.length > 0) {
        setUploadMessage(
          `${successfulUploads} uploaded successfully.\n${errors.join("\n")}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (documentId) => {
    setSelectedDocuments((previous) =>
      previous.includes(documentId)
        ? previous.filter((id) => id !== documentId)
        : [...previous, documentId]
    );
  };

  const selectAllDocuments = () => {
    setSelectedDocuments(
      documents.map((document) => document.document_id)
    );
  };

  const deselectAllDocuments = () => {
    setSelectedDocuments([]);
  };

  const handleAsk = async () => {
    const currentQuestion = question.trim();

    if (!currentQuestion || loading) return;

    if (selectedCount === 0) {
      alert("Please select at least one document.");
      return;
    }

    setChatMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: currentQuestion,
        topic: tutorTopic,
      },
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: currentQuestion,
          topic: tutorTopic,
          document_ids: selectedDocuments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to get answer");
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Sorry, something went wrong: ${error.message}`,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (selectedCount === 0) {
      setQuizError("Please select at least one document.");
      return;
    }

    setLoading(true);
    setQuiz([]);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizError("");

    try {
      const response = await fetch(`${API}/generate-quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_ids: selectedDocuments,
          topic: quizTopic,
          num_questions: numQuestions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Quiz generation failed");
      }

      setQuiz(data.questions || []);

      if (!data.questions || data.questions.length === 0) {
        setQuizError("No questions could be generated from this material.");
      }
    } catch (error) {
      setQuizError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = () =>
    quiz.filter(
      (item, index) =>
        selectedAnswers[index] === item.correct_answer
    ).length;

  const handleSubmitQuiz = () => {
    if (Object.keys(selectedAnswers).length !== quiz.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

    setQuizSubmitted(true);
  };

  const renderDocumentSelector = () => (
    <div className="panel document-selector">
      <div className="panel-heading">
        <div>
          <h2>Select study materials</h2>
          <p>Choose which PDFs LearnAI should use.</p>
        </div>
      </div>

      <div className="document-selection-actions">
        <button
          className="secondary-button"
          onClick={selectAllDocuments}
          disabled={!hasDocuments}
        >
          Select all
        </button>

        <button
          className="secondary-button"
          onClick={deselectAllDocuments}
          disabled={!hasDocuments}
        >
          Deselect all
        </button>

        <span className="muted">
          {selectedCount} of {documents.length} selected
        </span>
      </div>

      {documents.length > 0 ? (
        <div className="document-selection-list">
          {documents.map((document) => (
            <label
              className="document-selection-item"
              key={document.document_id}
            >
              <input
                type="checkbox"
                checked={selectedDocuments.includes(
                  document.document_id
                )}
                onChange={() =>
                  toggleDocument(document.document_id)
                }
              />

              <span className="pdf-icon">PDF</span>

              <span className="document-selection-info">
                <strong>{document.filename}</strong>
                <small>
                  {document.total_pages} pages ·{" "}
                  {document.total_chunks} chunks
                </small>
              </span>

              <span className="status-pill">Ready</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">
          No documents available. Upload a PDF first.
        </p>
      )}
    </div>
  );

  const renderDashboard = () => (
    <>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">YOUR LEARNING WORKSPACE</span>
          <h1>Welcome to LearnAI 👋</h1>
          <p>
            Learn smarter. Ask questions. Track your understanding.
          </p>
        </div>
        <div className="banner-icon">✧</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon purple">▤</span>
          <span className="stat-label">Uploaded documents</span>
          <h2>{documents.length.toString().padStart(2, "0")}</h2>
          <p>Study materials in your library</p>
        </div>

        <div className="stat-card">
          <span className="stat-icon blue">✧</span>
          <span className="stat-label">AI Tutor</span>
          <h2>{chatMessages.filter((m) => m.role === "assistant").length}</h2>
          <p>Answers generated this session</p>
        </div>

        <div className="stat-card">
          <span className="stat-icon orange">▣</span>
          <span className="stat-label">Quiz questions</span>
          <h2>{quiz.length.toString().padStart(2, "0")}</h2>
          <p>Questions in your latest quiz</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Get started</h2>
              <p>Your next learning activity</p>
            </div>
          </div>

          <div className="action-list">
            {[
              {
                title: "Upload study material",
                subtitle: "Add PDFs to your library",
                page: "My Documents",
                icon: "▤",
                color: "purple",
              },
              {
                title: "Ask your AI tutor",
                subtitle: "Get answers from your documents",
                page: "AI Tutor",
                icon: "✧",
                color: "blue",
              },
              {
                title: "Test your knowledge",
                subtitle: "Generate a personalized quiz",
                page: "Practice Quiz",
                icon: "▣",
                color: "orange",
              },
            ].map((item) => (
              <button
                className="action-item"
                key={item.page}
                onClick={() => setActivePage(item.page)}
              >
                <span className={`action-icon ${item.color}`}>
                  {item.icon}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <span className="action-arrow">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel document-panel">
          <h2>Document library</h2>

          {documents.length > 0 ? (
            <>
              <div className="document-preview">
                <span className="pdf-icon">PDF</span>
                <div>
                  <strong>{documents.length} documents</strong>
                  <small>Indexed and ready for learning</small>
                </div>
              </div>
              <span className="status-pill">Ready to learn</span>
            </>
          ) : (
            <div className="empty-state">
              <span>▤</span>
              <p>Your document library is empty.</p>
              <button
                className="primary-button"
                onClick={() => setActivePage("My Documents")}
              >
                Upload PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderDocuments = () => (
    <div className="panel page-panel">
      <span className="eyebrow">YOUR LIBRARY</span>
      <h1>My Documents</h1>
      <p>
        Upload multiple study materials and make them searchable with AI.
      </p>

      <div className="upload-area">
        <div className="upload-symbol">↑</div>
        <h3>Upload your study materials</h3>
        <p>Select one or multiple PDF documents from your computer.</p>

        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={(event) =>
            setFiles(Array.from(event.target.files || []))
          }
        />

        {files.length > 0 && (
          <p className="muted">
            {files.length} PDF(s) selected
          </p>
        )}

        <button
          className="primary-button"
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? "Processing PDFs..." : "Upload and process PDFs"}
        </button>

        {uploadMessage && (
          <p className="status-message">{uploadMessage}</p>
        )}
      </div>

      <h2 className="section-title">
        Uploaded documents ({documents.length})
      </h2>

      {documents.length > 0 ? (
        <div className="document-selection-list">
          {documents.map((document) => (
            <div
              className="document-preview"
              key={document.document_id}
            >
              <span className="pdf-icon">PDF</span>

              <div className="document-selection-info">
                <strong>{document.filename}</strong>
                <small>
                  {document.total_pages} pages ·{" "}
                  {document.total_chunks} chunks
                </small>
              </div>

              <div className="document-actions">
                <span className="status-pill">Ready</span>

                <button
                  className="delete-button"
                  onClick={() => handleDeleteDocument(document)}
                  disabled={
                    deletingDocumentId === document.document_id ||
                    loading
                  }
                >
                  {deletingDocumentId === document.document_id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No documents uploaded yet.</p>
      )}
    </div>
  );

  const renderTutor = () => (
    <div className="panel page-panel">
      <span className="eyebrow">AI-POWERED LEARNING</span>
      <h1>AI Tutor</h1>
      <p>
        Ask questions across your study materials and understand concepts.
      </p>

      {renderDocumentSelector()}

      <div className="topic-field">
        <label htmlFor="tutor-topic">Learning topic (optional)</label>
        <input
          id="tutor-topic"
          type="text"
          placeholder="e.g. Database Normalization, SQL Joins..."
          value={tutorTopic}
          onChange={(event) => setTutorTopic(event.target.value)}
          disabled={loading}
        />
        <small>
          Add a topic to focus the tutor's explanations.
        </small>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">✧</div>
              <h2>How can I help you learn?</h2>
              <p>
                Ask questions about your selected study materials.
                I'll explain concepts and provide source references.
              </p>
            </div>
          ) : (
            chatMessages.map((message, index) => (
              <div
                key={index}
                className={`message-row ${message.role}`}
              >
                <div className="message-avatar">
                  {message.role === "user" ? "You" : "AI"}
                </div>

                <div className="message-content">
                  <strong>
                    {message.role === "user"
                      ? "You"
                      : "LearnAI Assistant"}
                  </strong>

                  {message.topic && (
                    <small className="message-topic">
                      Topic: {message.topic}
                    </small>
                  )}

                  <p>{message.content}</p>

                  {message.sources && message.sources.length > 0 && (
                    <div className="source-list">
                      <strong>Source references</strong>
                      {message.sources.map((source, sourceIndex) => (
                        <span key={sourceIndex}>
                          {source.document} — Page {source.page}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="message-row assistant">
              <div className="message-avatar">AI</div>
              <div className="message-content">
                <strong>LearnAI Assistant</strong>
                <p>Thinking about your question...</p>
              </div>
            </div>
          )}
        </div>

        <div className="question-input">
          <textarea
            placeholder="Ask a question about your selected documents..."
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleAsk();
              }
            }}
            disabled={loading || !hasDocuments || selectedCount === 0}
          />

          <button
            className="primary-button"
            onClick={handleAsk}
            disabled={
              loading ||
              !hasDocuments ||
              selectedCount === 0 ||
              !question.trim()
            }
          >
            {loading ? "Thinking..." : "Send ↑"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => (
    <div className="page-panel">
      <div className="quiz-intro">
        <span className="eyebrow">ACTIVE LEARNING</span>
        <h1>Practice Quiz</h1>
        <p>
          Create personalized MCQs from your selected study materials.
        </p>
      </div>

      {renderDocumentSelector()}

      <div className="panel quiz-settings">
        <h2>Customize your quiz</h2>

        <div className="topic-field">
          <label htmlFor="quiz-topic">Topic (optional)</label>
          <input
            id="quiz-topic"
            type="text"
            placeholder="e.g. Operating System Scheduling..."
            value={quizTopic}
            onChange={(event) => setQuizTopic(event.target.value)}
            disabled={loading}
          />
          <small>
            Leave blank to generate questions across the selected PDFs.
          </small>
        </div>

        <div className="topic-field">
          <label htmlFor="question-count">Number of questions</label>
          <select
            id="question-count"
            value={numQuestions}
            onChange={(event) =>
              setNumQuestions(Number(event.target.value))
            }
            disabled={loading}
          >
            <option value={5}>5 questions</option>
            <option value={10}>10 questions</option>
            <option value={15}>15 questions</option>
            <option value={20}>20 questions</option>
          </select>
        </div>

        <button
          className="primary-button"
          onClick={handleGenerateQuiz}
          disabled={loading || selectedCount === 0}
        >
          {loading
            ? "Generating..."
            : `✧ Generate ${numQuestions} MCQs`}
        </button>

        {quizError && (
          <p className="status-message">{quizError}</p>
        )}
      </div>

      {quiz.length > 0 && (
        <div className="panel quiz-panel">
          <div className="panel-heading">
            <div>
              <h2>Your practice questions</h2>
              <p>
                {quiz.length} questions · {selectedCount} selected PDF(s)
                {quizTopic.trim() ? ` · Topic: ${quizTopic}` : " · All topics"}
              </p>
            </div>

            {quizSubmitted && (
              <span className="score-pill">
                Score: {calculateScore()} / {quiz.length}
              </span>
            )}
          </div>

          <div className="quiz-progress">
            <div
              style={{
                width: `${
                  (Object.keys(selectedAnswers).length / quiz.length) * 100
                }%`,
              }}
            />
          </div>

          <small className="muted">
            {Object.keys(selectedAnswers).length} of {quiz.length} answered
          </small>

          {quiz.map((item, index) => (
            <div className="quiz-question" key={index}>
              <h3>
                {index + 1}. {item.question}
              </h3>

              {item.options.map((option, optionIndex) => (
                <label className="quiz-option" key={optionIndex}>
                  <input
                    type="radio"
                    name={`question-${index}`}
                    checked={selectedAnswers[index] === option}
                    disabled={quizSubmitted}
                    onChange={() =>
                      setSelectedAnswers((previous) => ({
                        ...previous,
                        [index]: option,
                      }))
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}

              {quizSubmitted && (
                <div className="feedback">
                  <p>
                    <strong>Correct answer:</strong>{" "}
                    {item.correct_answer}
                  </p>
                  <p>
                    <strong>Explanation:</strong> {item.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}

          {!quizSubmitted ? (
            <button
              className="primary-button"
              onClick={handleSubmitQuiz}
              disabled={loading}
            >
              Submit quiz
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={handleGenerateQuiz}
              disabled={loading}
            >
              Generate another quiz
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderProgress = () => (
    <div className="panel page-panel">
      <span className="eyebrow">YOUR LEARNING JOURNEY</span>
      <h1>My Progress</h1>
      <p>Your current session activity.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Documents uploaded</span>
          <h2>{documents.length}</h2>
        </div>

        <div className="stat-card">
          <span className="stat-label">Questions answered</span>
          <h2>
            {chatMessages.filter((message) => message.role === "user").length}
          </h2>
        </div>

        <div className="stat-card">
          <span className="stat-label">Quiz score</span>
          <h2>
            {quizSubmitted
              ? `${calculateScore()}/${quiz.length}`
              : "—"}
          </h2>
        </div>
      </div>

      <div className="notice">
        These are session-level statistics. Persistent learning history
        will be added in a later stage.
      </div>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "My Documents":
        return renderDocuments();
      case "AI Tutor":
        return renderTutor();
      case "Practice Quiz":
        return renderQuiz();
      case "My Progress":
        return renderProgress();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">✧</span>
          <span>LearnAI</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav>
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-avatar">S</div>
          <div>
            <strong>Student Workspace</strong>
            <small>Personal learning space</small>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / </span>
            <strong>{activePage}</strong>
          </div>
          <span className="topbar-status">● Learning workspace</span>
        </header>

        <div className="page-content">{renderPage()}</div>
      </main>
    </div>
  );
}

export default App;
